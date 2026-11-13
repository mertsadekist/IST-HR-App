import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { notify, notifyRole, userIdForEmployee } from '../services/notificationService.js';
import {
  PROCESSES, validateSteps, actOnApproval, pendingForUser, approvalSummaries,
} from '../services/approvalService.js';

// Approval chains: settings (admin), and the decisions of whoever is an approver
// — managers included, who are often plain employees, so this router is not
// module-gated. Every decision is checked against the frozen chain.
const router = Router();
router.use(auth);

// ─── Settings ────────────────────────────────────────────────────────────────
router.get('/chains', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, company_id, process, steps, active, updated_at FROM approval_chains ORDER BY process, company_id');
    res.json(rows.map((r) => ({ ...r, steps: typeof r.steps === 'string' ? JSON.parse(r.steps) : r.steps })));
  } catch (err) { console.error('GET /approvals/chains error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/approvals/chains { company_id (0 = all companies), process, steps }
// An empty list removes the chain: HR decides directly again.
router.put('/chains', authorize('admin'), async (req, res) => {
  try {
    const { process, steps } = req.body || {};
    const companyId = Number(req.body?.company_id) || 0;
    if (!PROCESSES.includes(process)) return res.status(422).json({ error: 'Unknown process' });
    const problem = validateSteps(steps);
    if (problem) return res.status(422).json({ error: problem });
    const clean = steps.map((s) => ({ type: s.type, ...(s.type === 'role' ? { role: s.role } : {}), ...(s.type === 'user' ? { user_id: Number(s.user_id) } : {}) }));
    if (!clean.length) {
      await pool.query('DELETE FROM approval_chains WHERE company_id = ? AND process = ?', [companyId, process]);
    } else {
      await pool.query(
        `INSERT INTO approval_chains (company_id, process, steps, active, updated_by) VALUES (?, ?, ?, TRUE, ?)
         ON DUPLICATE KEY UPDATE steps = VALUES(steps), active = TRUE, updated_by = VALUES(updated_by)`,
        [companyId, process, JSON.stringify(clean), req.user.id]);
    }
    await addAudit(pool, req.user, 'Approvals', 'Chain Updated',
      `${process} chain for ${companyId ? `company #${companyId}` : 'all companies'}: ${clean.map((s) => s.role || s.type).join(' → ') || 'removed'}`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /approvals/chains error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// People who can be named in a "specific person" step.
router.get('/approvers', authorize('admin'), async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT id, name, role FROM users WHERE is_active = TRUE AND role <> 'recruiter' ORDER BY name");
    res.json(rows);
  } catch (err) { console.error('GET /approvals/approvers error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── My approvals ────────────────────────────────────────────────────────────
router.get('/count', async (req, res) => {
  try {
    res.json({ pending: (await pendingForUser(pool, req.user.id)).length });
  } catch (err) { console.error('GET /approvals/count error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/mine', async (req, res) => {
  try {
    const pending = await pendingForUser(pool, req.user.id);
    const ids = (p) => pending.filter((r) => r.process === p).map((r) => r.entity_id);
    const leaveIds = ids('leave'), otIds = ids('overtime');
    const reqIds = [...ids('expense'), ...ids('advance')];
    const leave = new Map(), ot = new Map(), reqs = new Map();
    if (reqIds.length) {
      const [rows] = await pool.query('SELECT id, type, title, amount, details, created_at FROM employee_requests WHERE id IN (?)', [reqIds]);
      for (const r of rows) {
        reqs.set(r.id, { ...r, amount: Number(r.amount), details: typeof r.details === 'string' ? JSON.parse(r.details) : (r.details || {}) });
      }
    }
    if (leaveIds.length) {
      const [rows] = await pool.query(
        `SELECT lr.id, lr.days, lr.reason, lt.name AS leave_type,
                DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date
           FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id IN (?)`, [leaveIds]);
      for (const r of rows) leave.set(r.id, r);
    }
    if (otIds.length) {
      const [rows] = await pool.query(
        `SELECT id, DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date, normal_minutes, night_minutes, rest_minutes,
                check_in, check_out, reason, source FROM overtime_records WHERE id IN (?)`, [otIds]);
      for (const r of rows) ot.set(r.id, r);
    }
    const empIds = [...new Set(pending.map((r) => r.employee_id))];
    const names = new Map();
    if (empIds.length) {
      const [rows] = await pool.query(
        `SELECT e.id, TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS name,
                COALESCE(jt.title, e.job_title_text) AS job_title
           FROM employees e LEFT JOIN job_titles jt ON jt.id = e.job_title_id WHERE e.id IN (?)`, [empIds]);
      for (const r of rows) names.set(r.id, r);
    }
    const chains = new Map([
      ...(await approvalSummaries(pool, 'leave', leaveIds)).entries(),
    ]);
    const otChains = await approvalSummaries(pool, 'overtime', otIds);
    const reqChains = new Map([
      ...(await approvalSummaries(pool, 'expense', ids('expense'))).entries(),
      ...(await approvalSummaries(pool, 'advance', ids('advance'))).entries(),
    ]);
    res.json(pending.map((r) => ({
      id: r.id, process: r.process, entity_id: r.entity_id, created_at: r.created_at,
      employee: names.get(r.employee_id) || null,
      details: (r.process === 'leave' ? leave : r.process === 'overtime' ? ot : reqs).get(r.entity_id) || null,
      chain: (r.process === 'leave' ? chains : r.process === 'overtime' ? otChains : reqChains).get(r.entity_id) || null,
    })).filter((x) => x.details));
  } catch (err) { console.error('GET /approvals/mine error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/approvals/:id/act { decision: 'Approved'|'Rejected', note }
router.post('/:id/act', async (req, res) => {
  try {
    const decision = req.body?.decision;
    if (!['Approved', 'Rejected'].includes(decision)) return res.status(422).json({ error: 'Approve or reject' });
    const note = String(req.body?.note || '').trim();
    const result = await actOnApproval(pool, { requestId: Number(req.params.id), userId: req.user.id, role: req.user.role, decision, note });
    if (result.error === 'not_found') return res.status(404).json({ error: 'Not found' });
    if (result.error === 'closed') return res.status(409).json({ error: 'This has already been decided' });
    if (result.error === 'not_approver') return res.status(403).json({ error: 'It is not waiting for you' });
    if (result.error === 'reason_required') return res.status(422).json({ error: 'Say why it is rejected' });

    const ar = result.request;
    const empUser = await userIdForEmployee(pool, ar.employee_id);
    if (result.status === 'Rejected') {
      // A rejection anywhere in the chain rejects the request itself.
      if (ar.process === 'leave') {
        await pool.query(
          `UPDATE leave_requests SET status = 'Rejected', decided_by = ?, decided_at = NOW(), decision_note = ?, approver_name = ?
            WHERE id = ? AND status = 'Pending'`, [req.user.id, note.slice(0, 500), req.user.name || null, ar.entity_id]);
        await notify(pool, { userId: empUser, companyId: ar.company_id, type: 'leave', title: 'Leave rejected', body: note, link: '/portal/leave' });
      } else if (ar.process === 'overtime') {
        await pool.query(
          `UPDATE overtime_records SET status = 'Rejected', decision_note = ?, decided_by = ?, decided_at = NOW()
            WHERE id = ? AND status = 'Pending'`, [note.slice(0, 500), req.user.id, ar.entity_id]);
      } else if (ar.process === 'expense' || ar.process === 'advance') {
        await pool.query(
          `UPDATE employee_requests SET status = 'Rejected', decision_note = ?, decided_by = ?, decided_at = NOW()
            WHERE id = ? AND status IN ('Pending', 'In Progress')`, [note.slice(0, 500), req.user.id, ar.entity_id]);
        await notify(pool, { userId: empUser, companyId: ar.company_id, type: 'request', title: 'Request declined', body: note, link: '/portal/requests' });
      }
    } else if (result.status === 'Approved') {
      // The chain is done; the final decision is HR's, as before.
      const link = { leave: '/leave', overtime: '/overtime' }[ar.process] || '/requests';
      const what = { leave: 'Leave request', overtime: 'Overtime', expense: 'Expense', advance: 'Salary advance' }[ar.process];
      const hrRoles = ['expense', 'advance'].includes(ar.process) ? ['admin', 'hr_manager', 'accountant'] : ['admin', 'hr_manager'];
      await notifyRole(pool, ar.company_id, hrRoles, {
        type: link === '/requests' ? 'request' : ar.process, title: `${what} ready for HR approval`, body: `Approved through the chain by ${req.user.name || 'the approver'}`, link,
      }, req.user.id);
      if (ar.process === 'leave') {
        await notify(pool, { userId: empUser, companyId: ar.company_id, type: 'leave', title: 'Leave approved by your manager', body: 'Waiting for HR', link: '/portal/leave' });
      }
    }
    await addAudit(pool, req.user, 'Approvals', decision,
      `${ar.process} #${ar.entity_id}: step ${ar.current_step + 1} ${decision.toLowerCase()}${note ? ` — ${note}` : ''}`);
    res.json({ success: true, status: result.status });
  } catch (err) { console.error('POST /approvals/:id/act error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
