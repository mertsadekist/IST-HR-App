import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { notify, notifyRole } from '../services/notificationService.js';
import { startApproval, cancelApproval, approvalSummaries } from '../services/approvalService.js';
import { validateRequisition } from '../services/reviewService.js';

// Hiring requests. A manager (anyone with reports) or HR raises one; it goes
// through the 'requisition' approval chain where one is set up; HR's approval
// creates a Draft vacancy from it.
const router = Router();
router.use(auth, tenantScope);

const HR = ['admin', 'hr_manager'];
const READERS = ['admin', 'hr_manager', 'recruiter'];
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };

async function myEmployee(userId) {
  const [[u]] = await pool.query(
    'SELECT e.id, e.company_id FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = ?', [userId]);
  return u || null;
}

const SELECT = `SELECT jr.*, DATE_FORMAT(jr.target_start, '%Y-%m-%d') AS target_start,
       d.name AS department_name, jt.title AS job_title_name, c.name AS company_name, u.name AS requested_by_name,
       TRIM(CONCAT(COALESCE(re.first_name, ''), ' ', COALESCE(re.last_name, ''))) AS replaces_name, v.status AS vacancy_status
  FROM job_requisitions jr
  JOIN companies c ON c.id = jr.company_id
  LEFT JOIN departments d ON d.id = jr.department_id
  LEFT JOIN job_titles jt ON jt.id = jr.job_title_id
  LEFT JOIN users u ON u.id = jr.requested_by
  LEFT JOIN employees re ON re.id = jr.replaces_employee_id
  LEFT JOIN vacancies v ON v.id = jr.vacancy_id`;

// GET /api/requisitions — HR and recruiters see all in scope; others their own.
router.get('/', async (req, res) => {
  try {
    let where; let params;
    if (READERS.includes(req.user.role)) {
      const co = companyClause(req, 'jr.company_id');
      where = `WHERE 1=1${co.clause}`; params = co.params;
    } else {
      where = 'WHERE jr.requested_by = ?'; params = [req.user.id];
    }
    if (req.query.status) { where += ' AND jr.status = ?'; params = [...params, req.query.status]; }
    const [rows] = await pool.query(`${SELECT} ${where} ORDER BY FIELD(jr.status, 'Pending') DESC, jr.created_at DESC LIMIT 300`, params);
    const chains = await approvalSummaries(pool, 'requisition', rows.map((r) => r.id)).catch(() => new Map());
    res.json(rows.map((r) => ({ ...r, approval: chains.get(r.id) || null })));
  } catch (err) { fail(res, 'GET /requisitions', err); }
});

// POST /api/requisitions — a manager (for their own company) or HR (any in scope).
router.post('/', async (req, res) => {
  try {
    const v = validateRequisition(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    const me = await myEmployee(req.user.id);
    let companyId;
    if (HR.includes(req.user.role)) {
      companyId = resolveWriteCompanyId(req, req.body.company_id) || me?.company_id;
    } else {
      if (!me) return res.status(403).json({ error: 'No employee profile linked to your account' });
      const [[team]] = await pool.query('SELECT COUNT(*) AS n FROM employees WHERE manager_employee_id = ?', [me.id]);
      if (!team.n) return res.status(403).json({ error: 'Only managers and HR can request a hire' });
      companyId = me.company_id;
    }
    if (!companyId) return res.status(400).json({ error: 'Choose the company' });
    if (v.data.replaces_employee_id) {
      const [[e]] = await pool.query('SELECT id FROM employees WHERE id = ? AND company_id = ?', [v.data.replaces_employee_id, companyId]);
      if (!e) return res.status(422).json({ error: 'The person replaced is not in this company' });
    }
    const [r] = await pool.query('INSERT INTO job_requisitions SET ?', {
      ...v.data, company_id: companyId, status: 'Pending', requested_by: req.user.id, requested_by_employee_id: me?.id || null,
    });
    let chained = null;
    if (me) {
      try {
        chained = await startApproval(pool, {
          process: 'requisition', entityId: r.insertId, companyId, employeeId: me.id,
          requesterUserId: req.user.id, title: `Hiring request to approve: ${v.data.title}`,
        });
      } catch (e) { console.error('requisition approval chain could not start (HR decides directly):', e.message); }
    }
    if (!chained) {
      await notifyRole(pool, companyId, HR, { type: 'requisition', title: `New hiring request: ${v.data.title}`, body: `${v.data.head_count} position(s)`, link: '/requisitions' }, req.user.id);
    }
    await addAudit(pool, req.user, 'Recruitment', 'Requisition Raised', `#${r.insertId} ${v.data.title} × ${v.data.head_count}`);
    res.status(201).json({ id: r.insertId, in_approval_chain: !!chained });
  } catch (err) { fail(res, 'POST /requisitions', err); }
});

async function scoped(req, id) {
  const co = companyClause(req, 'company_id');
  const [[r]] = await pool.query(`SELECT * FROM job_requisitions WHERE id = ?${co.clause}`, [id, ...co.params]);
  return r || null;
}

// PUT /api/requisitions/:id/approve { note?, override_chain? } — creates a Draft vacancy.
router.put('/:id/approve', authorize(...HR), async (req, res) => {
  try {
    const r = await scoped(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.status !== 'Pending') return res.status(409).json({ error: `It is already ${r.status}` });
    const [[chain]] = await pool.query("SELECT id, status FROM approval_requests WHERE process = 'requisition' AND entity_id = ?", [r.id]);
    if (chain?.status === 'Pending') {
      const why = String(req.body?.override_chain || '').trim();
      if (req.user.role !== 'admin' || why.length < 10) return res.status(409).json({ error: 'The approval chain has not finished yet', code: 'CHAIN_PENDING' });
      await pool.query("UPDATE approval_requests SET status = 'Approved', decided_at = NOW() WHERE id = ?", [chain.id]);
      await pool.query('INSERT INTO approval_actions SET ?', { request_id: chain.id, step_index: 99, actor_user_id: req.user.id, decision: 'Approved', note: why.slice(0, 500), on_behalf: 1 });
    }
    const salary = r.budget_min || r.budget_max ? `\n\nBudget: ${r.budget_min ?? '—'} – ${r.budget_max ?? '—'} a month.` : '';
    const [v] = await pool.query('INSERT INTO vacancies SET ?', {
      title: r.title, company_id: r.company_id, department_id: r.department_id, job_title_id: r.job_title_id,
      head_count: r.head_count, status: 'Draft', description: `${r.justification}${salary}`, created_by: req.user.id,
    });
    await pool.query(
      "UPDATE job_requisitions SET status = 'Approved', vacancy_id = ?, decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ?",
      [v.insertId, req.user.id, req.body?.note ? String(req.body.note).slice(0, 500) : null, r.id]);
    if (r.requested_by && r.requested_by !== req.user.id) {
      await notify(pool, { userId: r.requested_by, companyId: r.company_id, type: 'requisition', title: `Hiring request approved: ${r.title}`, body: null, link: '/portal/team' });
    }
    await addAudit(pool, req.user, 'Recruitment', 'Requisition Approved', `#${r.id} ${r.title}: vacancy #${v.insertId} created as Draft`);
    res.json({ success: true, vacancy_id: v.insertId });
  } catch (err) { fail(res, 'PUT /requisitions/:id/approve', err); }
});

router.put('/:id/reject', authorize(...HR), async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(422).json({ error: 'Give a reason' });
    const r = await scoped(req, req.params.id);
    if (!r) return res.status(404).json({ error: 'Not found' });
    if (r.status !== 'Pending') return res.status(409).json({ error: `It is already ${r.status}` });
    await pool.query("UPDATE job_requisitions SET status = 'Rejected', decided_by = ?, decided_at = NOW(), decision_note = ? WHERE id = ?",
      [req.user.id, reason.slice(0, 500), r.id]);
    await cancelApproval(pool, 'requisition', r.id);
    if (r.requested_by) await notify(pool, { userId: r.requested_by, companyId: r.company_id, type: 'requisition', title: `Hiring request declined: ${r.title}`, body: reason, link: '/portal/team' });
    await addAudit(pool, req.user, 'Recruitment', 'Requisition Rejected', `#${r.id} ${r.title}: ${reason}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /requisitions/:id/reject', err); }
});

// PUT /api/requisitions/:id/cancel — the requester withdraws it while pending.
router.put('/:id/cancel', async (req, res) => {
  try {
    const [[r]] = await pool.query('SELECT * FROM job_requisitions WHERE id = ?', [req.params.id]);
    if (!r || (r.requested_by !== req.user.id && !HR.includes(req.user.role))) return res.status(404).json({ error: 'Not found' });
    if (r.status !== 'Pending') return res.status(409).json({ error: `It is already ${r.status}` });
    await pool.query("UPDATE job_requisitions SET status = 'Cancelled' WHERE id = ?", [r.id]);
    await cancelApproval(pool, 'requisition', r.id);
    await addAudit(pool, req.user, 'Recruitment', 'Requisition Cancelled', `#${r.id} ${r.title}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /requisitions/:id/cancel', err); }
});

export default router;
