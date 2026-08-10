import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { notify, notifyRole, userIdForEmployee } from '../services/notificationService.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { ensureUploadDir, uploadPath } from '../config/storage.js';

const router = Router();
// Deliberately NOT module-gated: this is a self-service router. Every read
// below narrows to the caller's own record unless they are HR, and every
// write is authorize()-gated, so an employee reaches their own attendance
// and leave and nobody else's.
router.use(auth, tenantScope);

// Scanned proof for a leave request (the written request itself, and the
// manager's approval/rejection). Screenshots are the common case, so images
// matter as much as documents here.
const LEAVE_EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'];
const leaveUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUploadDir('leave_files')),
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = LEAVE_EXT.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error(`Unsupported file type — allowed: ${LEAVE_EXT.join(', ')}`), ok);
  },
});
const acceptLeaveFile = (req, res, next) => leaveUpload.single('file')(req, res, (err) => {
  if (!err) return next();
  const tooBig = err.code === 'LIMIT_FILE_SIZE';
  res.status(tooBig ? 413 : 422).json({ error: tooBig ? 'File must be 10 MB or smaller' : (err.message || 'Invalid upload') });
});

const isHR = (req) => ['admin', 'hr_manager'].includes(req.user.role);

// Loads a leave request within the caller's company scope.
async function getScopedRequest(req, id) {
  const co = companyClause(req, 'company_id');
  const [[lr]] = await pool.query('SELECT * FROM leave_requests WHERE id = ?' + co.clause, [id, ...co.params]);
  return lr || null;
}

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
  paid_mode: { type: 'string', enum: ['Full', 'Half', 'None'] },
}), async (req, res) => {
  try {
    const company_id = resolveWriteCompanyId(req, req.body.company_id);
    const { name, default_days, color } = req.body;
    // paid_mode is the richer field; is_paid is kept in sync because the
    // entitlement cap on approval still reads it.
    const paid_mode = ['Full', 'Half', 'None'].includes(req.body.paid_mode) ? req.body.paid_mode : 'Full';
    const [r] = await pool.query('INSERT INTO leave_types SET ?', {
      company_id, name, default_days: default_days || 0,
      paid_mode, is_paid: paid_mode === 'None' ? 0 : 1, color: color || null,
    });
    await addAudit(pool, req.user, 'Leave', 'Type Created', `Leave type "${name}" created (${paid_mode} paid)`);
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
    // The DATE_FORMAT aliases come after lr.* deliberately, so they override
    // the raw columns: a MySQL DATE read as a JS Date at local midnight loses a
    // day when serialised, and a leave request that starts on the 5th must not
    // be shown as starting on the 4th. /report already did this; this did not.
    let sql = `SELECT lr.*, lt.name as leave_type_name, lt.color,
               DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
               DATE_FORMAT(lr.end_date, '%Y-%m-%d')   AS end_date,
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

// ─── Annual report (one employee, full-year summary + detail) ────────────────
router.get('/report', async (req, res) => {
  try {
    let employeeId = req.query.employee_id ? Number(req.query.employee_id) : null;
    if (!isHR(req)) {
      employeeId = await myEmployeeId(req.user.id);
      if (!employeeId) return res.json({ employee: null, year: null, summary: [], requests: [] });
    }
    if (!employeeId) return res.status(400).json({ error: 'employee_id is required' });
    const year = Number(req.query.year) || new Date().getFullYear();

    const co = companyClause(req, 'company_id');
    const [[emp]] = await pool.query(
      'SELECT id, first_name, last_name, company_id FROM employees WHERE id = ?' + co.clause,
      [employeeId, ...co.params]
    );
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const [summary] = await pool.query(
      `SELECT lt.id AS leave_type_id, lt.name, lt.color, lt.is_paid,
              COALESCE(lb.entitled, lt.default_days) AS entitled,
              COALESCE(lb.used, 0) AS used
       FROM leave_types lt
       LEFT JOIN leave_balances lb ON lb.leave_type_id = lt.id AND lb.employee_id = ? AND lb.year = ?
       WHERE lt.status = 'Active' AND (lt.company_id = ? OR lt.company_id IS NULL)
       ORDER BY lt.company_id IS NULL DESC, lt.name`,
      [employeeId, year, emp.company_id]
    );

    // DATE_FORMAT keeps the plain calendar date (no Date-object timezone shift on serialization).
    const [requests] = await pool.query(
      `SELECT lr.id, lr.company_id, lr.employee_id, lr.leave_type_id,
              DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date,
              DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date,
              lr.days, lr.reason, lr.status, lr.decided_by, lr.decided_at, lr.decision_note,
              lr.approver_name, lr.created_by, lr.created_at,
              lt.name AS leave_type_name, lt.color, lt.paid_mode, u.name AS decided_by_name,
              (SELECT COUNT(*) FROM leave_files lf WHERE lf.leave_request_id = lr.id) AS file_count
       FROM leave_requests lr
       JOIN leave_types lt ON lr.leave_type_id = lt.id
       LEFT JOIN users u ON lr.decided_by = u.id
       WHERE lr.employee_id = ? AND YEAR(lr.start_date) = ?
       ORDER BY lr.start_date`,
      [employeeId, year]
    );

    res.json({ employee: emp, year, summary, requests });
  } catch (err) { console.error('GET /leave/report error:', err); res.status(500).json({ error: 'Internal server error' }); }
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

// ─── Supporting documents ────────────────────────────────────────────────────

// GET /leave/requests/:id/files — proof attached to a request (scoped).
router.get('/requests/:id/files', async (req, res) => {
  try {
    const lr = await getScopedRequest(req, req.params.id);
    if (!lr) return res.status(404).json({ error: 'Request not found' });
    // Employees may only see their own request's documents.
    if (!isHR(req) && (await myEmployeeId(req.user.id)) !== lr.employee_id) {
      return res.status(403).json({ error: 'Not your request' });
    }
    const [rows] = await pool.query(
      `SELECT f.id, f.kind, f.file_name, f.file_type, f.file_size, f.uploaded_at, u.name AS uploaded_by_name
       FROM leave_files f LEFT JOIN users u ON f.uploaded_by = u.id
       WHERE f.leave_request_id = ? ORDER BY f.uploaded_at`, [lr.id]);
    res.json(rows);
  } catch (err) { console.error('GET /leave/requests/:id/files error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /leave/requests/:id/files — attach proof. `kind` is request_proof (the
// original written request) or approval_proof (the manager's decision).
router.post('/requests/:id/files', acceptLeaveFile, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A file is required' });
    const lr = await getScopedRequest(req, req.params.id);
    if (!lr) { fs.unlink(req.file.path, () => {}); return res.status(404).json({ error: 'Request not found' }); }
    if (!isHR(req) && (await myEmployeeId(req.user.id)) !== lr.employee_id) {
      fs.unlink(req.file.path, () => {});
      return res.status(403).json({ error: 'Not your request' });
    }
    const kind = req.body.kind === 'approval_proof' ? 'approval_proof' : 'request_proof';
    const [r] = await pool.query('INSERT INTO leave_files SET ?', {
      leave_request_id: lr.id, company_id: lr.company_id, kind,
      file_name: req.file.originalname, file_type: req.file.mimetype, file_size: req.file.size,
      storage_key: req.file.filename, uploaded_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Leave', 'Document Attached', `${kind} attached to leave request #${lr.id}`);
    res.status(201).json({ id: r.insertId, kind });
  } catch (err) { console.error('POST /leave/requests/:id/files error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /leave/files/:fileId/download — stream an attached document (scoped).
router.get('/files/:fileId/download', async (req, res) => {
  try {
    const co = companyClause(req, 'f.company_id');
    const [[f]] = await pool.query(
      `SELECT f.*, lr.employee_id FROM leave_files f
       JOIN leave_requests lr ON lr.id = f.leave_request_id
       WHERE f.id = ?` + co.clause, [req.params.fileId, ...co.params]);
    if (!f) return res.status(404).json({ error: 'File not found' });
    if (!isHR(req) && (await myEmployeeId(req.user.id)) !== f.employee_id) {
      return res.status(403).json({ error: 'Not your document' });
    }
    const filePath = uploadPath('leave_files', f.storage_key);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, f.file_name || 'document');
  } catch (err) { console.error('GET /leave/files/:fileId/download error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// A decision must be documented: the written request has to be on file, and the
// manager who actually made the call has to be named (approvals are frequently
// given verbally or over chat by someone who never signs in here).
async function assertDecisionDocumented(requestId, approverName) {
  if (!approverName || !String(approverName).trim()) {
    return 'The name of the manager who made the decision is required';
  }
  const [[proof]] = await pool.query(
    "SELECT id FROM leave_files WHERE leave_request_id = ? AND kind = 'request_proof' LIMIT 1", [requestId]);
  if (!proof) return 'Attach a copy of the written request before recording a decision';
  return null;
}

// Approve — debits the employee's balance for that type/year (transactional). HR only.
router.put('/requests/:id/approve', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const co = companyClause(req, 'company_id');
    const [[lr]] = await conn.query('SELECT * FROM leave_requests WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!lr) { conn.release(); return res.status(404).json({ error: 'Request not found' }); }
    if (lr.status !== 'Pending') { conn.release(); return res.status(409).json({ error: `Request is already ${lr.status}` }); }

    const problem = await assertDecisionDocumented(lr.id, req.body.approver_name);
    if (problem) { conn.release(); return res.status(422).json({ error: problem }); }

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
    await conn.query('UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = NOW(), decision_note = ?, approver_name = ? WHERE id = ?',
      ['Approved', req.user.id, req.body.note || null, String(req.body.approver_name).trim(), lr.id]);
    await conn.commit();
    await addAudit(pool, req.user, 'Leave', 'Approved', `Leave request #${lr.id} approved (decision by ${String(req.body.approver_name).trim()})`);
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

    const problem = await assertDecisionDocumented(req.params.id, req.body.approver_name);
    if (problem) return res.status(422).json({ error: problem });

    await pool.query('UPDATE leave_requests SET status = ?, decided_by = ?, decided_at = NOW(), decision_note = ?, approver_name = ? WHERE id = ?',
      ['Rejected', req.user.id, req.body.note || null, String(req.body.approver_name).trim(), req.params.id]);
    await addAudit(pool, req.user, 'Leave', 'Rejected', `Leave request #${req.params.id} rejected (decision by ${String(req.body.approver_name).trim()})`);
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
