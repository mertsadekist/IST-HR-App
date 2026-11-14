import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { notify, notifyUsers, notifyRole, userIdForEmployee } from '../services/notificationService.js';
import {
  validateCycle, validateGoals, rating, editableBy, afterSelfReview, weightedScore, RECOMMENDATIONS,
} from '../services/reviewService.js';

// Appraisals (services/reviewService.js). HR runs cycles; each employee does
// their self review from the portal, their manager reviews them, HR finalizes.
// Not module-gated: employees and managers reach their own reviews here.
const router = Router();
router.use(auth, tenantScope);

const HR = ['admin', 'hr_manager'];
const isHR = (req) => HR.includes(req.user.role);
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };
const name = (r, p = '') => `${r[`${p}first_name`] || ''} ${r[`${p}last_name`] || ''}`.trim();

async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}

// ─── Cycles (HR) ─────────────────────────────────────────────────────────────
router.get('/cycles', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'rc.company_id');
    const [rows] = await pool.query(
      `SELECT rc.*, DATE_FORMAT(rc.period_start, '%Y-%m-%d') AS period_start, DATE_FORMAT(rc.period_end, '%Y-%m-%d') AS period_end,
              DATE_FORMAT(rc.self_due, '%Y-%m-%d') AS self_due, DATE_FORMAT(rc.manager_due, '%Y-%m-%d') AS manager_due,
              c.name AS company_name,
              (SELECT COUNT(*) FROM reviews r WHERE r.cycle_id = rc.id) AS total,
              (SELECT COUNT(*) FROM reviews r WHERE r.cycle_id = rc.id AND r.status = 'Self Review') AS at_self,
              (SELECT COUNT(*) FROM reviews r WHERE r.cycle_id = rc.id AND r.status = 'Manager Review') AS at_manager,
              (SELECT COUNT(*) FROM reviews r WHERE r.cycle_id = rc.id AND r.status = 'HR Review') AS at_hr,
              (SELECT COUNT(*) FROM reviews r WHERE r.cycle_id = rc.id AND r.status = 'Completed') AS completed
         FROM review_cycles rc JOIN companies c ON c.id = rc.company_id
        WHERE 1=1${co.clause} ORDER BY rc.created_at DESC`, co.params);
    res.json(rows);
  } catch (err) { fail(res, 'GET /reviews/cycles', err); }
});

router.post('/cycles', authorize(...HR), async (req, res) => {
  try {
    const v = validateCycle(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    const companyId = resolveWriteCompanyId(req, req.body.company_id);
    if (!companyId) return res.status(400).json({ error: 'Choose the company' });
    const [r] = await pool.query('INSERT INTO review_cycles SET ?', { ...v.data, company_id: companyId, created_by: req.user.id });
    await addAudit(pool, req.user, 'Reviews', 'Cycle Created', `Review cycle "${v.data.name}"`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { fail(res, 'POST /reviews/cycles', err); }
});

async function scopedCycle(req, id) {
  const co = companyClause(req, 'company_id');
  const [[c]] = await pool.query(`SELECT * FROM review_cycles WHERE id = ?${co.clause}`, [id, ...co.params]);
  return c || null;
}

router.put('/cycles/:id', authorize(...HR), async (req, res) => {
  try {
    const c = await scopedCycle(req, req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status === 'Closed') return res.status(409).json({ error: 'The cycle is closed' });
    const v = validateCycle(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    await pool.query('UPDATE review_cycles SET ? WHERE id = ?', [v.data, c.id]);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /reviews/cycles/:id', err); }
});

// POST /api/reviews/cycles/:id/launch — a review for every current employee of the company.
router.post('/cycles/:id/launch', authorize(...HR), async (req, res) => {
  try {
    const c = await scopedCycle(req, req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status !== 'Draft') return res.status(409).json({ error: `The cycle is already ${c.status}` });
    const [emps] = await pool.query(
      `SELECT id, manager_employee_id FROM employees
        WHERE company_id = ? AND status IN ('Active','Offboarding') AND is_owner = FALSE`, [c.company_id]);
    for (const e of emps) {
      await pool.query('INSERT IGNORE INTO reviews SET ?', {
        cycle_id: c.id, company_id: c.company_id, employee_id: e.id, manager_employee_id: e.manager_employee_id || null,
      });
    }
    await pool.query("UPDATE review_cycles SET status = 'Open', launched_at = NOW() WHERE id = ?", [c.id]);
    const [users] = await pool.query('SELECT id FROM users WHERE is_active = TRUE AND employee_id IN (?)', [emps.length ? emps.map((e) => e.id) : [0]]);
    await notifyUsers(pool, users.map((u) => u.id), { companyId: c.company_id, type: 'review', title: `Your review is open: ${c.name}`, body: null, link: '/portal/reviews' });
    await addAudit(pool, req.user, 'Reviews', 'Cycle Launched', `"${c.name}": ${emps.length} review(s)`);
    res.json({ success: true, reviews: emps.length });
  } catch (err) { fail(res, 'POST /reviews/cycles/:id/launch', err); }
});

router.post('/cycles/:id/close', authorize(...HR), async (req, res) => {
  try {
    const c = await scopedCycle(req, req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    if (c.status !== 'Open') return res.status(409).json({ error: `The cycle is ${c.status}` });
    await pool.query("UPDATE review_cycles SET status = 'Closed', closed_at = NOW() WHERE id = ?", [c.id]);
    await addAudit(pool, req.user, 'Reviews', 'Cycle Closed', `"${c.name}" closed`);
    res.json({ success: true });
  } catch (err) { fail(res, 'POST /reviews/cycles/:id/close', err); }
});

router.delete('/cycles/:id', authorize('admin'), async (req, res) => {
  try {
    const c = await scopedCycle(req, req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    await pool.query('DELETE FROM review_cycles WHERE id = ?', [c.id]);
    await addAudit(pool, req.user, 'Reviews', 'Cycle Deleted', `"${c.name}" deleted with its reviews`);
    res.json({ success: true });
  } catch (err) { fail(res, 'DELETE /reviews/cycles/:id', err); }
});

router.get('/cycles/:id/reviews', authorize(...HR), async (req, res) => {
  try {
    const c = await scopedCycle(req, req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    const [rows] = await pool.query(
      `SELECT r.id, r.employee_id, r.status, r.self_rating, r.manager_rating, r.final_rating, r.final_recommendation,
              r.manager_recommendation, e.first_name, e.last_name, d.name AS department,
              m.first_name AS m_first_name, m.last_name AS m_last_name
         FROM reviews r JOIN employees e ON e.id = r.employee_id
         LEFT JOIN departments d ON d.id = e.department_id
         LEFT JOIN employees m ON m.id = r.manager_employee_id
        WHERE r.cycle_id = ? ORDER BY FIELD(r.status, 'HR Review', 'Manager Review', 'Self Review', 'Completed'), e.first_name`, [c.id]);
    res.json(rows.map((r) => ({ ...r, employee_name: name(r), manager_name: name(r, 'm_') || null })));
  } catch (err) { fail(res, 'GET /reviews/cycles/:id/reviews', err); }
});

// ─── Reviews ─────────────────────────────────────────────────────────────────
// GET /api/reviews/mine — my own reviews, and those waiting for me as a manager.
router.get('/mine', async (req, res) => {
  try {
    const me = await myEmployeeId(req.user.id);
    if (!me) return res.json({ mine: [], team: [] });
    const cols = `r.id, r.status, r.final_rating, r.final_recommendation, rc.name AS cycle_name, rc.status AS cycle_status,
                  DATE_FORMAT(rc.self_due, '%Y-%m-%d') AS self_due, DATE_FORMAT(rc.manager_due, '%Y-%m-%d') AS manager_due,
                  e.first_name, e.last_name`;
    const [mine] = await pool.query(
      `SELECT ${cols} FROM reviews r JOIN review_cycles rc ON rc.id = r.cycle_id JOIN employees e ON e.id = r.employee_id
        WHERE r.employee_id = ? AND rc.status <> 'Draft' ORDER BY rc.created_at DESC`, [me]);
    const [team] = await pool.query(
      `SELECT ${cols} FROM reviews r JOIN review_cycles rc ON rc.id = r.cycle_id JOIN employees e ON e.id = r.employee_id
        WHERE r.manager_employee_id = ? AND rc.status = 'Open' ORDER BY FIELD(r.status, 'Manager Review') DESC, e.first_name`, [me]);
    res.json({
      mine: mine.map((r) => ({ ...r, final_rating: r.status === 'Completed' ? r.final_rating : null, final_recommendation: r.status === 'Completed' ? r.final_recommendation : null })),
      team: team.map((r) => ({ ...r, employee_name: name(r), final_rating: null, final_recommendation: null })),
    });
  } catch (err) { fail(res, 'GET /reviews/mine', err); }
});

/** A review with who the caller is to it; null when it is none of theirs. */
async function loadReview(req, id) {
  const [[r]] = await pool.query(
    `SELECT r.*, rc.name AS cycle_name, rc.status AS cycle_status,
            DATE_FORMAT(rc.period_start, '%Y-%m-%d') AS period_start, DATE_FORMAT(rc.period_end, '%Y-%m-%d') AS period_end,
            DATE_FORMAT(rc.self_due, '%Y-%m-%d') AS self_due, DATE_FORMAT(rc.manager_due, '%Y-%m-%d') AS manager_due,
            e.first_name, e.last_name, m.first_name AS m_first_name, m.last_name AS m_last_name
       FROM reviews r JOIN review_cycles rc ON rc.id = r.cycle_id JOIN employees e ON e.id = r.employee_id
       LEFT JOIN employees m ON m.id = r.manager_employee_id WHERE r.id = ?`, [id]);
  if (!r) return null;
  const me = await myEmployeeId(req.user.id);
  let hr = false;
  if (isHR(req)) {
    const co = companyClause(req, 'company_id');
    const [[x]] = await pool.query(`SELECT id FROM reviews WHERE id = ?${co.clause}`, [r.id, ...co.params]);
    hr = !!x;
  }
  const isEmployee = !!me && me === r.employee_id;
  const isManager = !!me && me === r.manager_employee_id;
  if (!hr && !isEmployee && !isManager) return null;
  return { r, roles: { isHR: hr, isEmployee, isManager } };
}

// GET /api/reviews/:id — the review as the caller may see it.
router.get('/:id(\\d+)', async (req, res) => {
  try {
    const got = await loadReview(req, req.params.id);
    if (!got) return res.status(404).json({ error: 'Not found' });
    const { r, roles } = got;
    const [goals] = await pool.query('SELECT * FROM review_goals WHERE review_id = ? ORDER BY sort_order, id', [r.id]);
    const done = r.status === 'Completed';
    // The employee sees their manager's part and HR's once the review is complete;
    // the manager sees the employee's part once it is submitted.
    const showManager = roles.isHR || roles.isManager || done;
    const showSelf = roles.isHR || roles.isEmployee || r.status !== 'Self Review';
    const out = {
      id: r.id, status: r.status, cycle_name: r.cycle_name, cycle_status: r.cycle_status,
      period_start: r.period_start, period_end: r.period_end, self_due: r.self_due, manager_due: r.manager_due,
      employee_name: name(r), manager_name: name(r, 'm_') || null, roles,
      editing: r.cycle_status === 'Open' ? editableBy({ status: r.status, ...roles }) : null,
      self_rating: showSelf ? r.self_rating : null, self_comments: showSelf ? r.self_comments : null,
      manager_rating: showManager ? r.manager_rating : null, manager_comments: showManager ? r.manager_comments : null,
      manager_recommendation: showManager ? r.manager_recommendation : null,
      final_rating: roles.isHR || done ? r.final_rating : null, final_recommendation: roles.isHR || done ? r.final_recommendation : null,
      hr_comments: roles.isHR || done ? r.hr_comments : null,
      goals: goals.map((g) => ({
        id: g.id, title: g.title, weight: g.weight, comment: g.comment,
        self_score: showSelf ? g.self_score : null, manager_score: showManager ? g.manager_score : null,
      })),
    };
    out.score_self = showSelf ? weightedScore(goals, 'self') : null;
    out.score_manager = showManager ? weightedScore(goals, 'manager') : null;
    res.json(out);
  } catch (err) { fail(res, 'GET /reviews/:id', err); }
});

// PUT /api/reviews/:id — save the caller's part (not yet submitted).
router.put('/:id(\\d+)', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const got = await loadReview(req, req.params.id);
    if (!got) return res.status(404).json({ error: 'Not found' });
    const { r, roles } = got;
    const part = r.cycle_status === 'Open' ? editableBy({ status: r.status, ...roles }) : null;
    if (!part) return res.status(409).json({ error: 'It is not yours to edit now' });
    const b = req.body || {};
    await conn.beginTransaction();
    if (part === 'self') {
      const v = validateGoals(b.goals || []);
      if (v.error) { await conn.rollback(); return res.status(422).json({ error: v.error }); }
      const r1 = rating(b.self_rating);
      if (r1 === undefined) { await conn.rollback(); return res.status(422).json({ error: 'Rating is 1 to 5' }); }
      await conn.query('DELETE FROM review_goals WHERE review_id = ?', [r.id]);
      let i = 0;
      for (const g of v.data) {
        await conn.query('INSERT INTO review_goals SET ?', { review_id: r.id, title: g.title, weight: g.weight, self_score: g.self_score, comment: g.comment, sort_order: i++ });
      }
      await conn.query('UPDATE reviews SET self_rating = ?, self_comments = ? WHERE id = ?', [r1, b.self_comments ? String(b.self_comments).slice(0, 5000) : null, r.id]);
    } else if (part === 'manager') {
      for (const g of b.goals || []) {
        const s = rating(g.manager_score);
        if (s === undefined) { await conn.rollback(); return res.status(422).json({ error: 'Scores are 1 to 5' }); }
        await conn.query('UPDATE review_goals SET manager_score = ? WHERE id = ? AND review_id = ?', [s, g.id, r.id]);
      }
      const r2 = rating(b.manager_rating);
      if (r2 === undefined) { await conn.rollback(); return res.status(422).json({ error: 'Rating is 1 to 5' }); }
      const rec = b.manager_recommendation && RECOMMENDATIONS.includes(b.manager_recommendation) ? b.manager_recommendation : null;
      await conn.query('UPDATE reviews SET manager_rating = ?, manager_comments = ?, manager_recommendation = ?, manager_user_id = ? WHERE id = ?',
        [r2, b.manager_comments ? String(b.manager_comments).slice(0, 5000) : null, rec, req.user.id, r.id]);
    } else {
      const r3 = rating(b.final_rating);
      if (r3 === undefined) { await conn.rollback(); return res.status(422).json({ error: 'Rating is 1 to 5' }); }
      const rec = b.final_recommendation && RECOMMENDATIONS.includes(b.final_recommendation) ? b.final_recommendation : null;
      await conn.query('UPDATE reviews SET final_rating = ?, final_recommendation = ?, hr_comments = ? WHERE id = ?',
        [r3, rec, b.hr_comments ? String(b.hr_comments).slice(0, 5000) : null, r.id]);
    }
    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback().catch(() => {}); fail(res, 'PUT /reviews/:id', err); }
  finally { conn.release(); }
});

// POST /api/reviews/:id/submit — hand the review on to the next person.
router.post('/:id(\\d+)/submit', async (req, res) => {
  try {
    const got = await loadReview(req, req.params.id);
    if (!got) return res.status(404).json({ error: 'Not found' });
    const { r, roles } = got;
    const part = r.cycle_status === 'Open' ? editableBy({ status: r.status, ...roles }) : null;
    if (!part) return res.status(409).json({ error: 'It is not yours to submit now' });
    const who = name(r);
    if (part === 'self') {
      if (!r.self_rating) return res.status(422).json({ error: 'Give yourself an overall rating first' });
      const managerUser = r.manager_employee_id ? await userIdForEmployee(pool, r.manager_employee_id) : null;
      const next = afterSelfReview(!!managerUser);
      await pool.query('UPDATE reviews SET status = ?, self_submitted_at = NOW() WHERE id = ?', [next, r.id]);
      if (managerUser) {
        await notify(pool, { userId: managerUser, companyId: r.company_id, type: 'review', title: `Review to complete: ${who}`, body: r.cycle_name, link: '/portal/reviews' });
      } else {
        await notifyRole(pool, r.company_id, HR, { type: 'review', title: `Review ready for HR: ${who}`, body: r.cycle_name, link: '/reviews' });
      }
    } else if (part === 'manager') {
      if (!r.manager_rating) return res.status(422).json({ error: 'Give an overall rating first' });
      await pool.query("UPDATE reviews SET status = 'HR Review', manager_submitted_at = NOW() WHERE id = ?", [r.id]);
      await notifyRole(pool, r.company_id, HR, { type: 'review', title: `Review ready for HR: ${who}`, body: r.cycle_name, link: '/reviews' }, req.user.id);
    } else {
      const final = r.final_rating || r.manager_rating || r.self_rating;
      if (!final) return res.status(422).json({ error: 'Set the final rating first' });
      await pool.query(
        `UPDATE reviews SET status = 'Completed', final_rating = ?, final_recommendation = COALESCE(final_recommendation, manager_recommendation),
                finalized_by = ?, finalized_at = NOW() WHERE id = ?`, [final, req.user.id, r.id]);
      const empUser = await userIdForEmployee(pool, r.employee_id);
      await notify(pool, { userId: empUser, companyId: r.company_id, type: 'review', title: `Your review is complete: ${r.cycle_name}`, body: null, link: '/portal/reviews' });
    }
    await addAudit(pool, req.user, 'Reviews', 'Submitted', `Review #${r.id} (${who}): ${part} part submitted`);
    res.json({ success: true });
  } catch (err) { fail(res, 'POST /reviews/:id/submit', err); }
});

// POST /api/reviews/:id/return { to: 'Self Review'|'Manager Review', note } — HR sends it back.
router.post('/:id(\\d+)/return', authorize(...HR), async (req, res) => {
  try {
    const got = await loadReview(req, req.params.id);
    if (!got || !got.roles.isHR) return res.status(404).json({ error: 'Not found' });
    const { r } = got;
    const to = req.body?.to;
    const order = ['Self Review', 'Manager Review', 'HR Review', 'Completed'];
    if (!['Self Review', 'Manager Review'].includes(to) || order.indexOf(to) >= order.indexOf(r.status)) {
      return res.status(422).json({ error: 'It can only go back to an earlier step' });
    }
    if (to === 'Manager Review' && !r.manager_employee_id) return res.status(422).json({ error: 'This person has no manager' });
    await pool.query('UPDATE reviews SET status = ? WHERE id = ?', [to, r.id]);
    const target = to === 'Self Review' ? await userIdForEmployee(pool, r.employee_id) : await userIdForEmployee(pool, r.manager_employee_id);
    await notify(pool, { userId: target, companyId: r.company_id, type: 'review', title: `Review returned to you: ${name(r)}`, body: req.body?.note ? String(req.body.note).slice(0, 300) : null, link: '/portal/reviews' });
    await addAudit(pool, req.user, 'Reviews', 'Returned', `Review #${r.id} returned to ${to}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'POST /reviews/:id/return', err); }
});

export default router;
