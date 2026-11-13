import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause, ownRecordsClause } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { notify, notifyRole, userIdForEmployee } from '../services/notificationService.js';
import { ensureUploadDir, uploadPath } from '../config/storage.js';
import { validateNewRequest, defaultReimbursementPeriod, CASE_STATUSES } from '../services/employeeRequestService.js';
import { startApproval, cancelApproval, approvalSummaries } from '../services/approvalService.js';

// Portal requests: letters, expenses, salary advances and HR cases
// (services/employeeRequestService.js). Employees raise and follow their own;
// admin, HR manager and accountant work the queue.
const router = Router();
router.use(auth, tenantScope);

const STAFF = ['admin', 'hr_manager', 'accountant'];
const isStaff = (req) => STAFF.includes(req.user.role);
const CHAINED = ['expense', 'advance'];
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const EXT = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'];
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ensureUploadDir('employee_requests')),
    filename: (req, file, cb) => cb(null, `${crypto.randomBytes(12).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = EXT.includes(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error(`Unsupported file type — allowed: ${EXT.join(', ')}`), ok);
  },
});
const acceptFile = (req, res, next) => upload.single('file')(req, res, (err) => {
  if (!err) return next();
  const tooBig = err.code === 'LIMIT_FILE_SIZE';
  res.status(tooBig ? 413 : 422).json({ error: tooBig ? 'File must be 10 MB or smaller' : (err.message || 'Invalid upload') });
});
const dropFile = (req) => { if (req.file) fs.unlink(req.file.path, () => {}); };

async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}

/** A request the caller may see: staff within their company scope, others only their own. */
async function loadRequest(req, id) {
  const co = isStaff(req) ? companyClause(req, 'r.company_id') : ownRecordsClause();
  const [[r]] = await pool.query(
    `SELECT r.*, TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name,
            DATE_FORMAT(r.due_date, '%Y-%m-%d') AS due_date, u.name AS assigned_to_name
       FROM employee_requests r JOIN employees e ON e.id = r.employee_id
       LEFT JOIN users u ON u.id = r.assigned_to
      WHERE r.id = ?` + co.clause, [id, ...co.params]);
  if (!r) return null;
  if (!isStaff(req) && r.employee_id !== (await myEmployeeId(req.user.id))) return null;
  r.details = typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {});
  r.amount = r.amount == null ? null : Number(r.amount);
  return r;
}

async function saveFile(reqRow, file, kind, userId) {
  await pool.query('INSERT INTO employee_request_files SET ?', {
    request_id: reqRow.id, kind, file_name: file.originalname, file_type: file.mimetype,
    file_size: file.size, storage_key: file.filename, uploaded_by: userId,
  });
}

// GET /api/requests?type=&status=  (staff: the queue; others: their own)
router.get('/', async (req, res) => {
  try {
    const params = [];
    let where = 'WHERE 1=1';
    if (isStaff(req)) {
      const co = companyClause(req, 'r.company_id');
      where += co.clause; params.push(...co.params);
    } else {
      const me = await myEmployeeId(req.user.id);
      if (!me) return res.json([]);
      where += ' AND r.employee_id = ?'; params.push(me);
    }
    if (req.query.type) { where += ' AND r.type = ?'; params.push(req.query.type); }
    if (req.query.status) { where += ' AND r.status = ?'; params.push(req.query.status); }
    const [rows] = await pool.query(
      `SELECT r.*, TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name,
              DATE_FORMAT(r.due_date, '%Y-%m-%d') AS due_date, u.name AS assigned_to_name,
              (SELECT COUNT(*) FROM employee_request_comments c WHERE c.request_id = r.id) AS comment_count,
              (SELECT COUNT(*) FROM employee_request_files f WHERE f.request_id = r.id AND f.kind = 'result') AS result_files
         FROM employee_requests r JOIN employees e ON e.id = r.employee_id
         LEFT JOIN users u ON u.id = r.assigned_to
        ${where}
        ORDER BY FIELD(r.status, 'Pending', 'In Progress', 'Approved') DESC, r.created_at DESC
        LIMIT 500`, params);
    const chained = rows.filter((r) => CHAINED.includes(r.type));
    const chains = new Map();
    for (const p of CHAINED) {
      const m = await approvalSummaries(pool, p, chained.filter((r) => r.type === p).map((r) => r.id)).catch(() => new Map());
      for (const [k, v] of m) chains.set(`${p}:${k}`, v);
    }
    res.json(rows.map((r) => ({
      ...r, amount: r.amount == null ? null : Number(r.amount),
      details: typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {}),
      approval: chains.get(`${r.type}:${r.id}`) || null,
    })));
  } catch (err) { console.error('GET /requests error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/requests/:id — with its files and comments
router.get('/:id', async (req, res) => {
  try {
    const r = await loadRequest(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    const [files] = await pool.query(
      'SELECT id, kind, file_name, file_size, uploaded_at FROM employee_request_files WHERE request_id = ? ORDER BY id', [r.id]);
    const [comments] = await pool.query(
      `SELECT c.id, c.body, c.created_at, c.user_id, u.name AS user_name, u.role AS user_role
         FROM employee_request_comments c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.request_id = ? ORDER BY c.id`, [r.id]);
    const approval = CHAINED.includes(r.type) ? (await approvalSummaries(pool, r.type, [r.id])).get(r.id) || null : null;
    res.json({ ...r, files, comments, approval });
  } catch (err) { console.error('GET /requests/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/requests (multipart: type + fields, optional `file` attachment)
router.post('/', acceptFile, async (req, res) => {
  try {
    const me = await myEmployeeId(req.user.id);
    if (!me) { dropFile(req); return res.status(400).json({ error: 'No employee profile linked to your account' }); }
    const [[todayRow]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
    const v = validateNewRequest(req.body.type, req.body, todayRow.d);
    if (v.error) { dropFile(req); return res.status(422).json({ error: v.error }); }
    const [[emp]] = await pool.query('SELECT id, company_id, first_name, last_name FROM employees WHERE id = ?', [me]);

    const [ins] = await pool.query('INSERT INTO employee_requests SET ?', {
      company_id: emp.company_id, employee_id: emp.id, type: req.body.type, status: 'Pending',
      title: v.data.title, amount: v.data.amount, details: JSON.stringify(v.data.details), created_by: req.user.id,
    });
    const row = { id: ins.insertId };
    if (req.file) await saveFile(row, req.file, 'attachment', req.user.id);

    let chained = null;
    if (CHAINED.includes(req.body.type)) {
      try {
        chained = await startApproval(pool, {
          process: req.body.type, entityId: ins.insertId, companyId: emp.company_id, employeeId: emp.id,
          requesterUserId: req.user.id, title: `${req.body.type === 'expense' ? 'Expense' : 'Salary advance'} to approve: ${emp.first_name} ${emp.last_name}`,
        });
      } catch (e) { console.error('request approval chain could not start (HR decides directly):', e.message); }
    }
    if (!chained) {
      await notifyRole(pool, emp.company_id, ['admin', 'hr_manager', ...(CHAINED.includes(req.body.type) ? ['accountant'] : [])], {
        type: 'request', title: `New ${req.body.type} request`, body: `${emp.first_name} ${emp.last_name}: ${v.data.title}`, link: '/requests',
      }, req.user.id);
    }
    await addAudit(pool, req.user, 'Requests', 'Created', `${req.body.type} request #${ins.insertId}: ${v.data.title}`);
    res.status(201).json({ id: ins.insertId, in_approval_chain: !!chained });
  } catch (err) { dropFile(req); console.error('POST /requests error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/requests/:id/files — the employee adds a receipt; staff upload the result (kind=result)
router.post('/:id/files', acceptFile, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'A file is required' });
    const r = await loadRequest(req, req.params.id);
    if (!r) { dropFile(req); return res.status(404).json({ error: 'Not found' }); }
    const kind = isStaff(req) && req.body.kind === 'result' ? 'result' : 'attachment';
    await saveFile(r, req.file, kind, req.user.id);
    await addAudit(pool, req.user, 'Requests', 'File Added', `${kind} "${req.file.originalname}" on request #${r.id}`);
    res.status(201).json({ success: true, kind });
  } catch (err) { dropFile(req); console.error('POST /requests/:id/files error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/files/:fileId/download', async (req, res) => {
  try {
    const [[f]] = await pool.query('SELECT * FROM employee_request_files WHERE id = ?', [req.params.fileId]);
    if (!f) return res.status(404).json({ error: 'File not found' });
    const r = await loadRequest(req, f.request_id);
    if (!r) return res.status(404).json({ error: 'File not found' });
    const filePath = uploadPath('employee_requests', f.storage_key);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.download(filePath, f.file_name || 'document');
  } catch (err) { console.error('GET /requests/files/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/requests/:id/comments { body } — the employee and HR talk on the request.
router.post('/:id/comments', async (req, res) => {
  try {
    const body = String(req.body?.body || '').trim();
    if (!body) return res.status(422).json({ error: 'Write a message' });
    const r = await loadRequest(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    await pool.query('INSERT INTO employee_request_comments SET ?', { request_id: r.id, user_id: req.user.id, body: body.slice(0, 2000) });
    // The other side hears about it: HR when the employee writes, the employee when HR does.
    if (isStaff(req)) {
      const empUser = await userIdForEmployee(pool, r.employee_id);
      if (empUser && empUser !== req.user.id) {
        await notify(pool, { userId: empUser, companyId: r.company_id, type: 'request', title: `Reply on: ${r.title}`, body: body.slice(0, 140), link: '/portal/requests' });
      }
    } else if (r.assigned_to) {
      await notify(pool, { userId: r.assigned_to, companyId: r.company_id, type: 'request', title: `New message on: ${r.title}`, body: body.slice(0, 140), link: '/requests' });
    } else {
      await notifyRole(pool, r.company_id, ['admin', 'hr_manager'], { type: 'request', title: `New message on: ${r.title}`, body: body.slice(0, 140), link: '/requests' }, req.user.id);
    }
    res.status(201).json({ success: true });
  } catch (err) { console.error('POST /requests/:id/comments error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/requests/:id/cancel — the employee withdraws a request nobody has decided yet.
router.put('/:id/cancel', async (req, res) => {
  try {
    const r = await loadRequest(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.employee_id !== (await myEmployeeId(req.user.id)) && !isStaff(req)) return res.status(403).json({ error: 'Not your request' });
    if (!['Pending', 'In Progress'].includes(r.status)) return res.status(409).json({ error: `It is already ${r.status}` });
    await pool.query("UPDATE employee_requests SET status = 'Cancelled' WHERE id = ?", [r.id]);
    if (CHAINED.includes(r.type)) await cancelApproval(pool, r.type, r.id);
    await addAudit(pool, req.user, 'Requests', 'Cancelled', `Request #${r.id} cancelled`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /requests/:id/cancel error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/requests/:id/reject { reason }
router.put('/:id/reject', authorize(...STAFF), async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(422).json({ error: 'Give a reason' });
    const r = await loadRequest(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (!['Pending', 'In Progress'].includes(r.status)) return res.status(409).json({ error: `It is already ${r.status}` });
    await pool.query(
      "UPDATE employee_requests SET status = 'Rejected', decision_note = ?, decided_by = ?, decided_at = NOW() WHERE id = ?",
      [reason.slice(0, 500), req.user.id, r.id]);
    if (CHAINED.includes(r.type)) await cancelApproval(pool, r.type, r.id);
    await notify(pool, { userId: await userIdForEmployee(pool, r.employee_id), companyId: r.company_id, type: 'request',
      title: `Request declined: ${r.title}`, body: reason, link: '/portal/requests' });
    await addAudit(pool, req.user, 'Requests', 'Rejected', `Request #${r.id} rejected: ${reason}`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /requests/:id/reject error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/requests/:id/approve — HR's final decision.
//   expense: { period? } → a one-time Reimbursement item in that payroll month
//   advance: { start_period?, instalment? } → a salary advance repaid by payroll
//   letter:  needs the issued letter uploaded first (kind=result)
router.put('/:id/approve', authorize(...STAFF), async (req, res) => {
  try {
    const r = await loadRequest(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (!['Pending', 'In Progress'].includes(r.status)) return res.status(409).json({ error: `It is already ${r.status}` });
    if (r.type === 'case') return res.status(409).json({ error: 'A case is resolved, not approved' });

    if (CHAINED.includes(r.type)) {
      const [[chain]] = await pool.query('SELECT id, status FROM approval_requests WHERE process = ? AND entity_id = ?', [r.type, r.id]);
      if (chain?.status === 'Pending') {
        const why = String(req.body?.override_chain || '').trim();
        if (req.user.role !== 'admin' || why.length < 10) return res.status(409).json({ error: 'The approval chain has not finished yet', code: 'CHAIN_PENDING' });
        await pool.query("UPDATE approval_requests SET status = 'Approved', decided_at = NOW() WHERE id = ?", [chain.id]);
        await pool.query('INSERT INTO approval_actions SET ?', { request_id: chain.id, step_index: 99, actor_user_id: req.user.id, decision: 'Approved', note: why.slice(0, 500), on_behalf: 1 });
      }
    }
    const [[todayRow]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
    let resultType = null, resultId = null, status = 'Completed', summary = '';

    if (r.type === 'expense') {
      const period = req.body?.period || defaultReimbursementPeriod(todayRow.d);
      if (!PERIOD_RE.test(period)) return res.status(422).json({ error: 'Choose the payroll month' });
      const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE company_id = ? AND period = ?', [r.company_id, period]);
      if (run && run.status !== 'Draft') return res.status(409).json({ error: `Payroll for ${period} is already ${run.status}; choose a later month` });
      const [adj] = await pool.query('INSERT INTO payroll_adjustments SET ?', {
        company_id: r.company_id, employee_id: r.employee_id, period, kind: 'earning', category: 'Reimbursement',
        label: String(r.title).slice(0, 150), amount: r.amount, note: `Expense request #${r.id}`, created_by: req.user.id,
      });
      resultType = 'adjustment'; resultId = adj.insertId;
      summary = `reimbursed in ${period} payroll${run ? ' (regenerate the Draft)' : ''}`;
    } else if (r.type === 'advance') {
      const start = req.body?.start_period || defaultReimbursementPeriod(todayRow.d);
      if (!PERIOD_RE.test(start)) return res.status(422).json({ error: 'Choose the first month to deduct' });
      const instalment = Math.round(Number(req.body?.instalment || r.details.instalment) * 100) / 100;
      if (!(instalment > 0) || instalment > r.amount) return res.status(422).json({ error: 'Invalid instalment' });
      const [loan] = await pool.query('INSERT INTO employee_loans SET ?', {
        company_id: r.company_id, employee_id: r.employee_id, type: 'Advance', principal: r.amount, instalment,
        start_period: start, reason: `Request #${r.id}: ${String(r.details.reason || '').slice(0, 450)}`, created_by: req.user.id,
      });
      resultType = 'loan'; resultId = loan.insertId;
      summary = `${instalment.toFixed(2)} a month from ${start}`;
    } else if (r.type === 'letter') {
      const [[f]] = await pool.query("SELECT id FROM employee_request_files WHERE request_id = ? AND kind = 'result' LIMIT 1", [r.id]);
      if (!f) return res.status(422).json({ error: 'Upload the issued letter first' });
      summary = 'letter issued';
    }

    await pool.query(
      `UPDATE employee_requests SET status = ?, result_type = ?, result_id = ?, decision_note = ?, decided_by = ?, decided_at = NOW()
        WHERE id = ?`, [status, resultType, resultId, req.body?.note ? String(req.body.note).slice(0, 500) : summary, req.user.id, r.id]);
    await notify(pool, { userId: await userIdForEmployee(pool, r.employee_id), companyId: r.company_id, type: 'request',
      title: `Request approved: ${r.title}`, body: summary, link: '/portal/requests' });
    await addAudit(pool, req.user, 'Requests', 'Approved', `Request #${r.id} (${r.type}) approved: ${summary}`);
    res.json({ success: true, result_type: resultType, result_id: resultId, needs_regenerate: summary.includes('regenerate') });
  } catch (err) { console.error('PUT /requests/:id/approve error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/requests/:id/case { status?, assigned_to?, due_date? } — working a case (or a letter).
router.put('/:id/case', authorize(...STAFF), async (req, res) => {
  try {
    const r = await loadRequest(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (['Rejected', 'Completed', 'Closed', 'Cancelled'].includes(r.status)) return res.status(409).json({ error: `It is already ${r.status}` });
    const data = {};
    if (req.body.status !== undefined) {
      const allowed = r.type === 'case' ? CASE_STATUSES : ['Pending', 'In Progress'];
      if (!allowed.includes(req.body.status)) return res.status(422).json({ error: 'Invalid status' });
      data.status = req.body.status;
      if (['Resolved', 'Closed'].includes(data.status)) { data.decided_by = req.user.id; data.decided_at = new Date(); }
    }
    if (req.body.assigned_to !== undefined) {
      const uid = req.body.assigned_to ? Number(req.body.assigned_to) : null;
      if (uid) {
        const [[u]] = await pool.query('SELECT id FROM users WHERE id = ? AND is_active = TRUE AND role IN (?)', [uid, STAFF]);
        if (!u) return res.status(422).json({ error: 'Choose someone from HR or finance' });
      }
      data.assigned_to = uid;
    }
    if (req.body.due_date !== undefined) {
      if (req.body.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(req.body.due_date)) return res.status(422).json({ error: 'Invalid due date' });
      data.due_date = req.body.due_date || null;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });
    await pool.query('UPDATE employee_requests SET ? WHERE id = ?', [data, r.id]);
    if (data.assigned_to && data.assigned_to !== req.user.id) {
      await notify(pool, { userId: data.assigned_to, companyId: r.company_id, type: 'request', title: `Assigned to you: ${r.title}`, body: r.employee_name, link: '/requests' });
    }
    if (data.status && data.status !== r.status) {
      await notify(pool, { userId: await userIdForEmployee(pool, r.employee_id), companyId: r.company_id, type: 'request',
        title: `${r.title}: ${data.status}`, body: null, link: '/portal/requests' });
    }
    await addAudit(pool, req.user, 'Requests', 'Updated', `Request #${r.id}: ${JSON.stringify({ ...data, decided_at: undefined })}`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /requests/:id/case error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// People a case can be assigned to.
router.get('/meta/assignees', authorize(...STAFF), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, role FROM users WHERE is_active = TRUE AND role IN (?) ORDER BY name', [STAFF]);
    res.json(rows);
  } catch (err) { console.error('GET /requests/meta/assignees error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
