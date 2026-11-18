import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause, resolveWriteCompanyId } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import {
  validatePolicy, validateEnrolment, validateEntitlement, validateUsage, nextTicketDue,
} from '../services/benefitsService.js';

// Benefits (services/benefitsService.js): group insurance policies, each
// employee's enrolment and dependents, and the air ticket entitlement.
// HR writes; an employee reads their own.
const router = Router();
router.use(auth, tenantScope);

const HR = ['admin', 'hr_manager'];
const isHR = (req) => HR.includes(req.user.role);
const ACTIVE = ['Onboarding', 'Active', 'Offboarding'];
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };
const ymd = (d) => (d ? (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10)) : null);

async function todayStr() {
  const [[r]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
  return r.d;
}
async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}
async function visibleEmployee(req, id) {
  if (isHR(req)) {
    const co = companyClause(req, 'company_id');
    const [[e]] = await pool.query(`SELECT id, company_id, first_name, last_name FROM employees WHERE id = ?${co.clause}`, [id, ...co.params]);
    return e || null;
  }
  if ((await myEmployeeId(req.user.id)) !== Number(id)) return null;
  const [[e]] = await pool.query('SELECT id, company_id, first_name, last_name FROM employees WHERE id = ?', [id]);
  return e || null;
}
const entity = (id, changes) => ({ type: 'employee', id, changes });

// ─── Group insurance policies (HR) ───────────────────────────────────────────
router.get('/policies', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'p.company_id');
    const [rows] = await pool.query(
      `SELECT p.*, DATE_FORMAT(p.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(p.end_date, '%Y-%m-%d') AS end_date,
              c.name AS company_name, (SELECT COUNT(*) FROM employee_insurance ei WHERE ei.policy_id = p.id) AS enrolled
         FROM insurance_policies p JOIN companies c ON c.id = p.company_id WHERE 1=1${co.clause}
        ORDER BY p.end_date DESC`, co.params);
    res.json(rows);
  } catch (err) { fail(res, 'GET /benefits/policies', err); }
});

router.post('/policies', authorize(...HR), async (req, res) => {
  try {
    const v = validatePolicy(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    const companyId = resolveWriteCompanyId(req, req.body.company_id);
    if (!companyId) return res.status(400).json({ error: 'Choose the company' });
    const [r] = await pool.query('INSERT INTO insurance_policies SET ?', { ...v.data, company_id: companyId, created_by: req.user.id });
    await addAudit(pool, req.user, 'Benefits', 'Policy Created', `${v.data.provider} ${v.data.policy_number || ''} (${v.data.start_date} → ${v.data.end_date})`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { fail(res, 'POST /benefits/policies', err); }
});

async function scopedPolicy(req, id) {
  const co = companyClause(req, 'company_id');
  const [[p]] = await pool.query(`SELECT * FROM insurance_policies WHERE id = ?${co.clause}`, [id, ...co.params]);
  return p || null;
}

router.put('/policies/:id', authorize(...HR), async (req, res) => {
  try {
    const p = await scopedPolicy(req, req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const v = validatePolicy({ ...p, start_date: ymd(p.start_date), end_date: ymd(p.end_date), ...req.body });
    if (v.error) return res.status(422).json({ error: v.error });
    await pool.query('UPDATE insurance_policies SET ? WHERE id = ?', [v.data, p.id]);
    await addAudit(pool, req.user, 'Benefits', 'Policy Updated', `${v.data.provider} ${v.data.policy_number || ''}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /benefits/policies/:id', err); }
});

router.delete('/policies/:id', authorize('admin'), async (req, res) => {
  try {
    const p = await scopedPolicy(req, req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    const [[n]] = await pool.query('SELECT COUNT(*) AS n FROM employee_insurance WHERE policy_id = ?', [p.id]);
    if (n.n) return res.status(409).json({ error: 'People are enrolled on this policy; move them first' });
    await pool.query('DELETE FROM insurance_policies WHERE id = ?', [p.id]);
    await addAudit(pool, req.user, 'Benefits', 'Policy Deleted', `${p.provider} ${p.policy_number || ''}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'DELETE /benefits/policies/:id', err); }
});

// ─── One person's benefits ───────────────────────────────────────────────────
async function benefitsOf(e) {
  const [[ins]] = await pool.query(
    `SELECT ei.*, DATE_FORMAT(ei.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(ei.end_date, '%Y-%m-%d') AS end_date,
            p.provider, p.policy_number, p.plan_name, DATE_FORMAT(p.end_date, '%Y-%m-%d') AS policy_end
       FROM employee_insurance ei JOIN insurance_policies p ON p.id = ei.policy_id WHERE ei.employee_id = ?`, [e.id]);
  const [[ent]] = await pool.query(
    "SELECT te.*, DATE_FORMAT(te.start_from, '%Y-%m-%d') AS start_from FROM ticket_entitlements te WHERE te.employee_id = ?", [e.id]);
  const [usages] = await pool.query(
    `SELECT tu.id, tu.mode, tu.amount, tu.notes, tu.payroll_adjustment_id, DATE_FORMAT(tu.used_on, '%Y-%m-%d') AS used_on,
            pa.period AS paid_in
       FROM ticket_usages tu LEFT JOIN payroll_adjustments pa ON pa.id = tu.payroll_adjustment_id
      WHERE tu.employee_id = ? ORDER BY tu.used_on DESC`, [e.id]);
  const dependents = ins ? (typeof ins.dependents === 'string' ? JSON.parse(ins.dependents) : ins.dependents) || [] : [];
  const entitlement = ent ? { ...ent, max_amount: ent.max_amount == null ? null : Number(ent.max_amount) } : null;
  return {
    insurance: ins ? { ...ins, premium: ins.premium == null ? null : Number(ins.premium), dependents } : null,
    ticket: entitlement,
    usages: usages.map((u) => ({ ...u, amount: Number(u.amount) })),
    next_ticket_due: nextTicketDue(entitlement, usages[0]?.used_on || null),
  };
}

router.get('/employees/:id', async (req, res) => {
  try {
    const e = await visibleEmployee(req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    const out = await benefitsOf(e);
    // An employee does not see the premium the company pays.
    if (!isHR(req) && out.insurance) delete out.insurance.premium;
    res.json(out);
  } catch (err) { fail(res, 'GET /benefits/employees/:id', err); }
});

router.get('/mine', async (req, res) => {
  try {
    const me = await myEmployeeId(req.user.id);
    if (!me) return res.json({ insurance: null, ticket: null, usages: [], next_ticket_due: null });
    const out = await benefitsOf({ id: me });
    if (out.insurance) delete out.insurance.premium;
    res.json(out);
  } catch (err) { fail(res, 'GET /benefits/mine', err); }
});

// PUT /api/benefits/employees/:id/insurance { policy_id, category, card_number, start_date, end_date, premium, dependents }
router.put('/employees/:id/insurance', authorize(...HR), async (req, res) => {
  try {
    const e = await visibleEmployee(req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    if (req.body.remove) {
      await pool.query('DELETE FROM employee_insurance WHERE employee_id = ?', [e.id]);
      await addAudit(pool, req.user, 'Benefits', 'Insurance Removed', `Insurance enrolment removed for ${e.first_name} ${e.last_name}`, null, entity(e.id));
      return res.json({ success: true });
    }
    const v = validateEnrolment(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    const [[p]] = await pool.query('SELECT id FROM insurance_policies WHERE id = ? AND company_id = ?', [v.data.policy_id, e.company_id]);
    if (!p) return res.status(422).json({ error: 'That policy is not this employee’s company’s' });
    const row = { ...v.data, dependents: JSON.stringify(v.data.dependents), updated_by: req.user.id };
    await pool.query(
      `INSERT INTO employee_insurance SET ?, employee_id = ?
       ON DUPLICATE KEY UPDATE policy_id = VALUES(policy_id), category = VALUES(category), card_number = VALUES(card_number),
         start_date = VALUES(start_date), end_date = VALUES(end_date), premium = VALUES(premium), dependents = VALUES(dependents), updated_by = VALUES(updated_by)`,
      [row, e.id]);
    await addAudit(pool, req.user, 'Benefits', 'Insurance Updated',
      `Insurance for ${e.first_name} ${e.last_name}: category ${v.data.category || '—'}, ${v.data.dependents.length} dependent(s)`, null, entity(e.id));
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /benefits/employees/:id/insurance', err); }
});

// PUT /api/benefits/employees/:id/ticket { frequency_months, ticket_class, destination, max_amount, dependents_count, start_from, notes } or { remove: true }
router.put('/employees/:id/ticket', authorize(...HR), async (req, res) => {
  try {
    const e = await visibleEmployee(req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    if (req.body.remove) {
      await pool.query('DELETE FROM ticket_entitlements WHERE employee_id = ?', [e.id]);
      await addAudit(pool, req.user, 'Benefits', 'Ticket Entitlement Removed', `Air ticket entitlement removed for ${e.first_name} ${e.last_name}`, null, entity(e.id));
      return res.json({ success: true });
    }
    const v = validateEntitlement(req.body);
    if (v.error) return res.status(422).json({ error: v.error });
    await pool.query(
      `INSERT INTO ticket_entitlements SET ?, employee_id = ?
       ON DUPLICATE KEY UPDATE frequency_months = VALUES(frequency_months), ticket_class = VALUES(ticket_class), destination = VALUES(destination),
         max_amount = VALUES(max_amount), dependents_count = VALUES(dependents_count), start_from = VALUES(start_from), notes = VALUES(notes), updated_by = VALUES(updated_by)`,
      [{ ...v.data, updated_by: req.user.id }, e.id]);
    await addAudit(pool, req.user, 'Benefits', 'Ticket Entitlement Set',
      `Air ticket for ${e.first_name} ${e.last_name}: every ${v.data.frequency_months} months, ${v.data.ticket_class}${v.data.destination ? ` to ${v.data.destination}` : ''}`, null, entity(e.id));
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /benefits/employees/:id/ticket', err); }
});

// POST /api/benefits/employees/:id/ticket-usage { used_on, mode: Ticket|Cash, amount, period (Cash), notes }
router.post('/employees/:id/ticket-usage', authorize(...HR), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const e = await visibleEmployee(req, req.params.id);
    if (!e) return res.status(404).json({ error: 'Not found' });
    const [[ent]] = await pool.query('SELECT * FROM ticket_entitlements WHERE employee_id = ?', [e.id]);
    const v = validateUsage(req.body, ent ? { ...ent, start_from: ymd(ent.start_from) } : null, await todayStr());
    if (v.error) return res.status(422).json({ error: v.error });
    if (v.data.mode === 'Cash') {
      const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE company_id = ? AND period = ?', [e.company_id, v.data.period]);
      if (run && run.status !== 'Draft') return res.status(409).json({ error: `Payroll for ${v.data.period} is already ${run.status}; choose a later month` });
    }
    await conn.beginTransaction();
    let adjId = null;
    if (v.data.mode === 'Cash') {
      const [adj] = await conn.query('INSERT INTO payroll_adjustments SET ?', {
        company_id: e.company_id, employee_id: e.id, period: v.data.period, kind: 'earning', category: 'Allowance',
        label: `Air ticket allowance (${v.data.used_on})`, amount: v.data.amount, note: v.data.notes, created_by: req.user.id,
      });
      adjId = adj.insertId;
    }
    const [r] = await conn.query('INSERT INTO ticket_usages SET ?', {
      company_id: e.company_id, employee_id: e.id, used_on: v.data.used_on, mode: v.data.mode, amount: v.data.amount,
      payroll_adjustment_id: adjId, notes: v.data.notes, created_by: req.user.id,
    });
    await conn.commit();
    await addAudit(pool, req.user, 'Benefits', 'Ticket Used',
      `Air ticket for ${e.first_name} ${e.last_name}: ${v.data.mode === 'Cash' ? `cash ${v.data.amount} in ${v.data.period} payroll` : `ticket ${v.data.amount}`} on ${v.data.used_on}`, null, entity(e.id));
    res.status(201).json({ id: r.insertId });
  } catch (err) { await conn.rollback().catch(() => {}); fail(res, 'POST /benefits/employees/:id/ticket-usage', err); }
  finally { conn.release(); }
});

router.delete('/ticket-usage/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[u]] = await pool.query(`SELECT * FROM ticket_usages WHERE id = ?${co.clause}`, [req.params.id, ...co.params]);
    if (!u) return res.status(404).json({ error: 'Not found' });
    if (u.payroll_adjustment_id) {
      const [[p]] = await pool.query('SELECT item_id, settlement_id FROM payroll_adjustments WHERE id = ?', [u.payroll_adjustment_id]);
      if (p && (p.item_id || p.settlement_id)) return res.status(409).json({ error: 'Already paid by payroll; it cannot be removed' });
      await pool.query('DELETE FROM payroll_adjustments WHERE id = ?', [u.payroll_adjustment_id]);
    }
    await pool.query('DELETE FROM ticket_usages WHERE id = ?', [u.id]);
    await addAudit(pool, req.user, 'Benefits', 'Ticket Use Removed', `Ticket use #${u.id} (${u.mode} ${u.amount})`, null, entity(u.employee_id));
    res.json({ success: true });
  } catch (err) { fail(res, 'DELETE /benefits/ticket-usage/:id', err); }
});

// GET /api/benefits/overview — insurance ending and tickets falling due within 60 days.
router.get('/overview', authorize(...HR), async (req, res) => {
  try {
    const today = await todayStr();
    const co = companyClause(req, 'e.company_id');
    const [ins] = await pool.query(
      `SELECT e.id AS employee_id, TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS employee_name, p.provider,
              DATE_FORMAT(COALESCE(ei.end_date, p.end_date), '%Y-%m-%d') AS ends_on
         FROM employee_insurance ei JOIN insurance_policies p ON p.id = ei.policy_id JOIN employees e ON e.id = ei.employee_id
        WHERE e.status IN (?) AND COALESCE(ei.end_date, p.end_date) <= DATE_ADD(CURDATE(), INTERVAL 60 DAY)${co.clause}
        ORDER BY ends_on`, [ACTIVE, ...co.params]);
    const [ents] = await pool.query(
      `SELECT te.*, DATE_FORMAT(te.start_from, '%Y-%m-%d') AS start_from, e.id AS employee_id,
              TRIM(CONCAT(COALESCE(e.first_name,''),' ',COALESCE(e.last_name,''))) AS employee_name,
              (SELECT DATE_FORMAT(MAX(tu.used_on), '%Y-%m-%d') FROM ticket_usages tu WHERE tu.employee_id = e.id) AS last_used
         FROM ticket_entitlements te JOIN employees e ON e.id = te.employee_id WHERE e.status IN (?)${co.clause}`, [ACTIVE, ...co.params]);
    const horizon = new Date(Date.parse(today) + 60 * 86_400_000).toISOString().slice(0, 10);
    const tickets = ents.map((t) => ({ employee_id: t.employee_id, employee_name: t.employee_name, ticket_class: t.ticket_class, destination: t.destination,
      due: nextTicketDue({ ...t }, t.last_used) })).filter((t) => t.due && t.due <= horizon).sort((a, b) => a.due.localeCompare(b.due));
    res.json({ today, insurance_ending: ins, tickets_due: tickets });
  } catch (err) { fail(res, 'GET /benefits/overview', err); }
});

export default router;
