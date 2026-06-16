import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { notify, notifyRole, userIdForEmployee } from '../services/notificationService.js';

const router = Router();
router.use(auth, tenantScope);

const isHR = (req) => ['admin', 'hr_manager'].includes(req.user.role);

// Resolve the employee_id linked to the calling user (employees self-service).
async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}

// Inclusive whole-day count between two ISO dates.
function inclusiveDays(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s) || isNaN(e) || e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

// ─── Leave types (company + global) ──────────────────────────────────────────
router.get('/types', async (req, res) => {
  try {
    let sql = "SELECT * FROM leave_types WHERE status = 'Active'";
    const params = [];
    if (req.companyId != null) { sql += ' AND (company_id = ? OR company_id IS NULL)'; params.push(req.companyId); }
    sql += ' ORDER BY company_id IS NULL DESC, name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /leave/types error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/types', authorize('admin', 'hr_manager'), validate({
  name: { required: true, type: 'string', minLen: 1, maxLen: 100 },
  default_days: { type: 'number', min: 0 },
  is_paid: { type: 'boolean' },
}), async (req, res) => {
  try {
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    const { name, default_days, is_paid, color } = req.body;
    const [r] = await pool.query('INSERT INTO leave_types SET ?', {
      company_id, name, default_days: default_days || 0,
      is_paid: is_paid === false ? 0 : 1, color: color || null,
    });
    await addAudit(pool, req.user, 'Leave', 'Type Created', `Leave type "${name}" created`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { console.error('POST /leave/types error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Balances ────────────────────────────────────────────────────────────────
router.get('/balances', async (req, res) => {
  try {
    const co = companyClause(req, 'lb.company_id');
    let sql = `SELECT lb.*, lt.name as leave_type_name, lt.color,
               (lb.entitled - lb.used) as remaining,
               e.first_name, e.last_name
               FROM leave_balances lb
               JOIN leave_types lt ON lb.leave_type_id = lt.id
               JOIN employees e ON lb.employee_id = e.id
               WHERE 1=1` + co.clause;
    const params = [...co.params];

    // Employees may only see their own balances
    if (!isHR(req)) {
      const empId = await myEmployeeId(req.user.id);
      if (!empId) return res.json([]);
      sql += ' AND lb.employee_id = ?'; params.push(empId);
    } else if (req.query.employee_id) {
      sql += ' AND lb.employee_id = ?'; params.push(req.query.employee_id);
    }
    if (req.query.year) { sql += ' AND lb.year = ?'; params.push(req.query.year); }
    sql += ' ORDER BY lb.year DESC, lt.name';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /leave/balances error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Set / update an employee's entitlement for a leave type & year (HR only)
router.post('/balances', authorize('admin', 'hr_manager'), validate({
  employee_id: { required: true, type: 'integer' },
  leave_type_id: { required: true, type: 'integer' },
  year: { required: true, type: 'integer', min: 2000, max: 3000 },
  entitled: { required: true, type: 'number', min: 0 },
}), async (req, res) => {
  try {
    const { employee_id, leave_type_id, year, entitled } = req.body;
    // Employee must belong to the caller's company
    const eco = companyClause(req, 'company_id');
    const [[emp]] = await pool.query('SELECT company_id FROM employees WHERE id = ?' + eco.clause, [employee_id, ...eco.params]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    await pool.query(
      `INSERT INTO leave_balances (company_id, employee_id, leave_type_id, year, entitled)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE entitled = VALUES(entitled)`,
      [emp.company_id, employee_id, leave_type_id, year, entitled]
    );
    await addAudit(pool, req.user, 'Leave', 'Balance Set', `Entitlement ${entitled} for employee #${employee_id} (type ${leave_type_id}, ${year})`);
    res.status(201).json({ success: true });
  } catch (err) { console.error('POST /leave/balances error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Requests ────────────────────────────────────────────────────────────────
router.get('/requests', async (req, res) => {
  try {
    const co = companyClause(req, 'lr.company_id');
    let sql = `SELECT lr.*, lt.name as leave_type_name, lt.color,
               e.first_name, e.last_name, u.name as decided_by_name
               FROM leave_requests lr
               JOIN leave_types lt ON lr.leave_type_id = lt.id
               JOIN employees e ON lr.employee_id = e.id
               LEFT JOIN users u ON lr.decided_by = u.id
               WHERE 1=1` + co.clause;
    const params = [...co.params];

    if (!isHR(req)) {
      const empId = await myEmployeeId(req.user.id);
      if (!empId) return res.json([]);
      sql += ' AND lr.employee_id = ?'; params.push(empId);
    } else if (req.query.employee_id) {
      sql += ' AND lr.employee_id = ?'; params.push(req.query.employee_id);
    }
    if (req.query.status) { sql += ' AND lr.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY lr.created_at DESC';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /leave/requests error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Create a request. Employees create for themselves; HR may specify employee_id.
router.post('/requests', validate({
  leave_type_id: { required: true, type: 'integer' },
  start_date: { required: true, type: 'date' },
  end_date: { required: true, type: 'date' },
}), async (req, res) => {
  try {
    const { leave_type_id, start_date, end_date, reason } = req.body;

    let employeeId;
    if (isHR(req) && req.body.employee_id) {
      employeeId = Number(req.body.employee_id);
    } else {
      employeeId = await myEmployeeId(req.user.id);
      if (!employeeId) return res.status(400).json({ error: 'No employee profile linked to your account' });
    }

    // Employee must belong to caller's company
    const eco = companyClause(req, 'company_id');
    const [[emp]] = await pool.query('SELECT company_id FROM employees WHERE id = ?' + eco.clause, [employeeId, ...eco.params]);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const days = inclusiveDays(start_date, end_date);
    if (days <= 0) return res.status(422).json({ error: 'Validation failed', errors: [{ field: 'end_date', message: 'end_date must be on or after start_date' }] });

    const [r] = await pool.query('INSERT INTO leave_requests SET ?', {
      company_id: emp.company_id, employee_id: employeeId, leave_type_id,
      start_date, end_date, days, reason: reason || null,
      status: 'Pending', created_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Leave', 'Requested', `Leave request #${r.insertId} (${days} day(s)) for employee #${employeeId}`);
    await notifyRole(pool, emp.company_id, ['admin', 'hr_manager'],
      { type: 'leave', title: 'New leave request', body: `${days} day(s) requested (employee #${employeeId})`, link: '/leave' }, req.user.id);
    res.status(201).json({ id: r.insertId, days, status: 'Pending' });
  } catch (err) { console.error('POST /leave/requests error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Approve — debits the employee's balance for that type/year (transactional). HR only.
router.put('/requests/:id/approve', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const co = companyClause(req, 'company_id');
    const [[lr]] = await conn.query('SELECT * FROM leave_requests WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!lr) { conn.release(); return res.status(404).json({ error: 'Request not found' }); }
    if (lr.status !== 'Pending') { conn.release(); return res.status(409).json({ error: `Request is already ${lr.status}` }); }

    await conn.beginTransaction();
    const year = new Date(lr.start_date).getFullYear();

    // Ensure a balance row exists (seed entitlement from the leave type default)
    const [[type]] = await conn.query('SELECT default_days, is_paid FROM leave_types WHERE id = ?', [lr.leave_type_id]);
    await conn.query(
      `INSERT INTO leave_balances (company_id, employee_id, leave_type_id, year, entitled)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE entitled = entitled`,
      [lr.company_id, lr.employee_id, lr.leave_type_id, year, type?.default_days || 0]
    );
    const [[bal]] = await conn.query(
      'SELECT * FROM leave_balances WHERE employee_id = ? AND leave_type_id = ? AND year = ? FOR UPDATE',
      [lr.employee_id, lr.leave_type_id, year]
    );

    // Paid leave types are capped by entitlement; unpaid leave is never blocked.
    const remaining = Number(bal.entitled) - Number(bal.used);
    if (type?.is_paid && Number(lr.days) > remaining) {
      await conn.rollback(); conn.release();
      return res.status(400).json({ error: `Insufficient balance: ${remaining} day(s) remaining, ${lr.days} requested` });
    }

    await conn.query('UPDATE leave_balances SET used = used + ? WHERE id = ?', [lr.days, bal.id]);
    await conn.query('UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ?',
      ['Approved', req.user.id, req.body.note || null, lr.id]);
    await conn.commit();
    await addAudit(pool, req.user, 'Leave', 'Approved', `Leave request #${lr.id} approved`);
    const empUserId = await userIdForEmployee(pool, lr.employee_id);
    await notify(pool, { userId: empUserId, companyId: lr.company_id, type: 'leave', title: 'Leave approved', body: `Your leave request (${lr.days} day(s)) was approved`, link: '/leave' });
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /leave/requests/:id/approve error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally { conn.release(); }
});

// Reject (HR only)
router.put('/requests/:id/reject', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[lr]] = await pool.query('SELECT status FROM leave_requests WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!lr) return res.status(404).json({ error: 'Request not found' });
    if (lr.status !== 'Pending') return res.status(409).json({ error: `Request is already ${lr.status}` });
    await pool.query('UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ?',
      ['Rejected', req.user.id, req.body.note || null, req.params.id]);
    await addAudit(pool, req.user, 'Leave', 'Rejected', `Leave request #${req.params.id} rejected`);
    const [[lrRow]] = await pool.query('SELECT employee_id, company_id, days FROM leave_requests WHERE id = ?', [req.params.id]);
    if (lrRow) {
      const empUserId = await userIdForEmployee(pool, lrRow.employee_id);
      await notify(pool, { userId: empUserId, companyId: lrRow.company_id, type: 'leave', title: 'Leave rejected', body: `Your leave request was rejected${req.body.note ? ': ' + req.body.note : ''}`, link: '/leave' });
    }
    res.json({ success: true });
  } catch (err) { console.error('PUT /leave/requests/:id/reject error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Cancel — owner (the employee) or HR. Credits balance back if it was approved.
router.put('/requests/:id/cancel', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const co = companyClause(req, 'company_id');
    const [[lr]] = await conn.query('SELECT * FROM leave_requests WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!lr) { conn.release(); return res.status(404).json({ error: 'Request not found' }); }

    if (!isHR(req)) {
      const empId = await myEmployeeId(req.user.id);
      if (empId !== lr.employee_id) { conn.release(); return res.status(403).json({ error: 'You can only cancel your own request' }); }
    }
    if (lr.status === 'Cancelled') { conn.release(); return res.status(409).json({ error: 'Already cancelled' }); }

    await conn.beginTransaction();
    if (lr.status === 'Approved') {
      const year = new Date(lr.start_date).getFullYear();
      await conn.query('UPDATE leave_balances SET used = GREATEST(0, used - ?) WHERE employee_id = ? AND leave_type_id = ? AND year = ?',
        [lr.days, lr.employee_id, lr.leave_type_id, year]);
    }
    await conn.query("UPDATE leave_requests SET status = 'Cancelled' WHERE id = ?", [lr.id]);
    await conn.commit();
    await addAudit(pool, req.user, 'Leave', 'Cancelled', `Leave request #${lr.id} cancelled`);
    res.json({ success: true });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /leave/requests/:id/cancel error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally { conn.release(); }
});

export default router;
