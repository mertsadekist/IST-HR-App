import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';

const router = Router();
router.use(auth, tenantScope);

// Work day is considered "late" if check-in is after this local time.
const LATE_AFTER = { h: 9, m: 15 };
const VALID_STATUS = ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Remote'];

const isHR = (req) => ['admin', 'hr_manager', 'hr_specialist'].includes(req.user.role);

async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}

// Employee must belong to the caller's company; returns company_id or null.
async function employeeCompany(req, employeeId) {
  const eco = companyClause(req, 'company_id');
  const [[e]] = await pool.query('SELECT company_id FROM employees WHERE id = ?' + eco.clause, [employeeId, ...eco.params]);
  return e?.company_id || null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function lateFromCheckIn(dt) {
  const d = new Date(dt);
  return (d.getHours() > LATE_AFTER.h) || (d.getHours() === LATE_AFTER.h && d.getMinutes() > LATE_AFTER.m);
}

// ─── List ────────────────────────────────────────────────────────────────────
// GET /api/attendance?employee_id=&from=&to=&status=  (employees see only their own)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    let sql = `SELECT a.*, e.first_name, e.last_name
               FROM attendance a JOIN employees e ON a.employee_id = e.id
               WHERE 1=1` + co.clause;
    const params = [...co.params];

    if (!isHR(req)) {
      const empId = await myEmployeeId(req.user.id);
      if (!empId) return res.json([]);
      sql += ' AND a.employee_id = ?'; params.push(empId);
    } else if (req.query.employee_id) {
      sql += ' AND a.employee_id = ?'; params.push(req.query.employee_id);
    }
    if (req.query.from) { sql += ' AND a.work_date >= ?'; params.push(req.query.from); }
    if (req.query.to) { sql += ' AND a.work_date <= ?'; params.push(req.query.to); }
    if (req.query.status) { sql += ' AND a.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY a.work_date DESC, e.first_name LIMIT 500';
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { console.error('GET /attendance error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── HR: mark/record attendance for a date (upsert) ──────────────────────────
router.post('/', authorize('admin', 'hr_manager', 'hr_specialist'), validate({
  employee_id: { required: true, type: 'integer' },
  work_date: { required: true, type: 'date' },
  status: { type: 'string', enum: VALID_STATUS },
}), async (req, res) => {
  try {
    const { employee_id, work_date, check_in, check_out, status, notes } = req.body;
    const companyId = await employeeCompany(req, employee_id);
    if (!companyId) return res.status(404).json({ error: 'Employee not found' });

    let workHours = null;
    if (check_in && check_out) {
      workHours = Math.round(((new Date(check_out) - new Date(check_in)) / 3600000) * 100) / 100;
      if (workHours < 0) return res.status(422).json({ error: 'Validation failed', errors: [{ field: 'check_out', message: 'check_out must be after check_in' }] });
    }

    await pool.query(
      `INSERT INTO attendance (company_id, employee_id, work_date, check_in, check_out, work_hours, status, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE check_in=VALUES(check_in), check_out=VALUES(check_out),
         work_hours=VALUES(work_hours), status=VALUES(status), notes=VALUES(notes)`,
      [companyId, employee_id, work_date, check_in || null, check_out || null, workHours, status || 'Present', notes || null, req.user.id]
    );
    await addAudit(pool, req.user, 'Attendance', 'Recorded', `Attendance for employee #${employee_id} on ${work_date} (${status || 'Present'})`);
    res.status(201).json({ success: true });
  } catch (err) { console.error('POST /attendance error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Self-service check-in / check-out ───────────────────────────────────────
router.post('/check-in', async (req, res) => {
  try {
    const empId = await myEmployeeId(req.user.id);
    if (!empId) return res.status(400).json({ error: 'No employee profile linked to your account' });
    const companyId = await employeeCompany(req, empId);
    if (!companyId) return res.status(404).json({ error: 'Employee not found' });

    const date = todayISO();
    const now = new Date();
    const status = lateFromCheckIn(now) ? 'Late' : 'Present';

    const [[existing]] = await pool.query('SELECT id, check_in FROM attendance WHERE employee_id = ? AND work_date = ?', [empId, date]);
    if (existing?.check_in) return res.status(409).json({ error: 'Already checked in today' });

    if (existing) {
      await pool.query('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?', [now, status, existing.id]);
    } else {
      await pool.query(
        'INSERT INTO attendance (company_id, employee_id, work_date, check_in, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [companyId, empId, date, now, status, req.user.id]
      );
    }
    await addAudit(pool, req.user, 'Attendance', 'Check In', `${req.user.name} checked in (${status})`);
    res.json({ success: true, check_in: now, status });
  } catch (err) { console.error('POST /attendance/check-in error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/check-out', async (req, res) => {
  try {
    const empId = await myEmployeeId(req.user.id);
    if (!empId) return res.status(400).json({ error: 'No employee profile linked to your account' });

    const date = todayISO();
    const [[row]] = await pool.query('SELECT id, check_in FROM attendance WHERE employee_id = ? AND work_date = ?', [empId, date]);
    if (!row || !row.check_in) return res.status(400).json({ error: 'You have not checked in today' });

    const now = new Date();
    const workHours = Math.round(((now - new Date(row.check_in)) / 3600000) * 100) / 100;
    await pool.query('UPDATE attendance SET check_out = ?, work_hours = ? WHERE id = ?', [now, workHours, row.id]);
    await addAudit(pool, req.user, 'Attendance', 'Check Out', `${req.user.name} checked out (${workHours}h)`);
    res.json({ success: true, check_out: now, work_hours: workHours });
  } catch (err) { console.error('POST /attendance/check-out error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Monthly summary ─────────────────────────────────────────────────────────
// GET /api/attendance/summary?employee_id=&month=YYYY-MM
router.get('/summary', async (req, res) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : todayISO().slice(0, 7);
    const co = companyClause(req, 'company_id');
    let sql = `SELECT status, COUNT(*) as count, SUM(COALESCE(work_hours,0)) as hours
               FROM attendance WHERE DATE_FORMAT(work_date, '%Y-%m') = ?` + co.clause;
    const params = [month, ...co.params];

    if (!isHR(req)) {
      const empId = await myEmployeeId(req.user.id);
      if (!empId) return res.json({ month, by_status: [], total_hours: 0 });
      sql += ' AND employee_id = ?'; params.push(empId);
    } else if (req.query.employee_id) {
      sql += ' AND employee_id = ?'; params.push(req.query.employee_id);
    }
    sql += ' GROUP BY status';
    const [rows] = await pool.query(sql, params);
    const total_hours = rows.reduce((s, r) => s + Number(r.hours || 0), 0);
    res.json({ month, by_status: rows, total_hours: Math.round(total_hours * 100) / 100 });
  } catch (err) { console.error('GET /attendance/summary error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── HR: edit / delete a record ──────────────────────────────────────────────
router.put('/:id', authorize('admin', 'hr_manager', 'hr_specialist'), validate({
  status: { type: 'string', enum: VALID_STATUS },
}), async (req, res) => {
  try {
    const { check_in, check_out, status, notes } = req.body;
    const data = {};
    if (check_in !== undefined) data.check_in = check_in || null;
    if (check_out !== undefined) data.check_out = check_out || null;
    if (status !== undefined) data.status = status;
    if (notes !== undefined) data.notes = notes;
    if ((check_in || data.check_in) && (check_out || data.check_out)) {
      const ci = data.check_in ?? check_in;
      const co2 = data.check_out ?? check_out;
      data.work_hours = Math.round(((new Date(co2) - new Date(ci)) / 3600000) * 100) / 100;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'No updatable fields provided' });

    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('UPDATE attendance SET ? WHERE id = ?' + co.clause, [data, req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Attendance record not found' });
    await addAudit(pool, req.user, 'Attendance', 'Updated', `Attendance #${req.params.id} updated`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /attendance/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [result] = await pool.query('DELETE FROM attendance WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Attendance record not found' });
    await addAudit(pool, req.user, 'Attendance', 'Deleted', `Attendance #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /attendance/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
