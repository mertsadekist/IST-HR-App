import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { addAudit } from '../services/auditService.js';
import { loadLeavePolicy, splitAcrossTiers } from '../services/leavePolicyService.js';
import { resolveEffectiveSchedule, holidaysBetween } from '../services/workScheduleService.js';
import { teamOf } from '../services/orgService.js';
import {
  validateAdjustment, carryForwardDays, carryExpiry, lapsedDays, encashmentAmount,
  datesBetween, requestWarnings, parseOpeningCsv, leaveIcs, DAY_BASES,
} from '../services/leaveBalanceService.js';
import {
  balancesFor, employeesById, countRequestDays, typesOfPool, serviceMonthsOn,
} from '../services/leaveBalanceStore.js';

// Leave balances beyond the entitlement (the ledger, carry-forward, lapse,
// encashment), the pre-submit preview, the approver's context, the team
// calendar and calendar files. Mounted on /api/leave next to routes/leave.js.
const router = Router();
router.use(auth, tenantScope);

const HR = ['admin', 'hr_manager'];
const isHR = (req) => HR.includes(req.user.role);
const ACTIVE = ['Onboarding', 'Active', 'Offboarding'];
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fail = (res, where, err) => { console.error(`${where} error:`, err); res.status(500).json({ error: 'Internal server error' }); };

async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}
async function todayStr() {
  const [[r]] = await pool.query("SELECT DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS d");
  return r.d;
}
/** An employee HR may act on in the company they are working in. */
async function scopedEmployee(req, id) {
  const co = companyClause(req, 'company_id');
  const [[e]] = await pool.query('SELECT id FROM employees WHERE id = ?' + co.clause, [id, ...co.params]);
  return e ? (await employeesById(pool, [e.id]))[0] : null;
}
async function activeType(id) {
  const [[t]] = await pool.query("SELECT * FROM leave_types WHERE id = ? AND status = 'Active'", [id]);
  return t || null;
}

/** Balance, pay split and warnings for a would-be request. */
async function assess({ emp, type, start, end, days, policy, excludeRequestId = null }) {
  const year = Number(start.slice(0, 4));
  const poolId = policy.poolByType.get(type.id) ?? type.id;
  const bal = (await balancesFor(pool, { employees: [emp], poolIds: [poolId], year, policy })).get(`${emp.id}:${poolId}`);
  const cap = bal.entitled == null ? null : round2(bal.entitled + bal.adjusted);
  const pay = splitAcrossTiers(policy.tiersByType.get(type.id) || [], bal.used, days, cap);
  const [overlap] = await pool.query(
    `SELECT id FROM leave_requests WHERE employee_id = ? AND status IN ('Pending','Approved')
       AND start_date <= ? AND end_date >= ? AND id <> ? LIMIT 1`, [emp.id, end, start, excludeRequestId || 0]);
  const today = await todayStr();
  const noticeGiven = Math.round((Date.parse(start) - Date.parse(today)) / 86400000);
  const warnings = requestWarnings({
    type, days, serviceMonths: serviceMonthsOn(emp.start_date, start), noticeGiven,
    remaining: bal.remaining, hasOverlap: overlap.length > 0,
  });
  return { balance: { ...bal, pool_type_id: poolId }, pay, warnings };
}

// ─── Leave type policy ───────────────────────────────────────────────────────
// PUT /api/leave/types/:id/policy { day_basis, carry_forward_max, carry_forward_expiry_months }
router.put('/types/:id/policy', authorize(...HR), async (req, res) => {
  try {
    const [[t]] = await pool.query('SELECT * FROM leave_types WHERE id = ?', [req.params.id]);
    if (!t) return res.status(404).json({ error: 'Leave type not found' });
    if (t.company_id == null && req.user.role !== 'admin') return res.status(403).json({ error: 'Only an admin changes a group-wide type' });
    if (t.company_id != null) {
      const co = companyClause(req, 'id');
      const [[c]] = await pool.query('SELECT id FROM companies WHERE id = ?' + co.clause, [t.company_id, ...co.params]);
      if (!c) return res.status(404).json({ error: 'Leave type not found' });
    }
    const data = {};
    const b = req.body || {};
    if (b.day_basis !== undefined) {
      if (!DAY_BASES.includes(b.day_basis)) return res.status(422).json({ error: 'Choose calendar or working days' });
      data.day_basis = b.day_basis;
    }
    if (b.carry_forward_max !== undefined) {
      const v = b.carry_forward_max === null || b.carry_forward_max === '' ? null : Number(b.carry_forward_max);
      if (v != null && !(v >= 0 && v <= 366)) return res.status(422).json({ error: 'Carry-forward must be 0 to 366 days, or empty for no limit' });
      data.carry_forward_max = v;
    }
    if (b.carry_forward_expiry_months !== undefined) {
      const v = b.carry_forward_expiry_months === null || b.carry_forward_expiry_months === '' ? null : Math.round(Number(b.carry_forward_expiry_months));
      if (v != null && !(v >= 1 && v <= 12)) return res.status(422).json({ error: 'Expiry must be 1 to 12 months, or empty for never' });
      data.carry_forward_expiry_months = v;
    }
    if (!Object.keys(data).length) return res.status(400).json({ error: 'Nothing to update' });
    await pool.query('UPDATE leave_types SET ? WHERE id = ?', [data, t.id]);
    await addAudit(pool, req.user, 'Leave', 'Type Policy Updated', `"${t.name}": ${JSON.stringify(data)}`);
    res.json({ success: true });
  } catch (err) { fail(res, 'PUT /leave/types/:id/policy', err); }
});

// ─── Preview before sending ──────────────────────────────────────────────────
// POST /api/leave/preview { leave_type_id, start_date, end_date, partial_hours?, employee_id? (HR) }
router.post('/preview', async (req, res) => {
  try {
    const b = req.body || {};
    if (!DATE_RE.test(b.start_date || '') || !DATE_RE.test(b.end_date || '') || b.end_date < b.start_date) {
      return res.status(422).json({ error: 'Choose the dates' });
    }
    const type = await activeType(b.leave_type_id);
    if (!type) return res.status(422).json({ error: 'Choose the leave type' });
    let emp;
    if (isHR(req) && b.employee_id) emp = await scopedEmployee(req, b.employee_id);
    else { const me = await myEmployeeId(req.user.id); emp = me ? (await employeesById(pool, [me]))[0] : null; }
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    let counted;
    if (b.partial_hours != null && b.partial_hours !== '' && b.start_date === b.end_date) {
      const hours = Number(b.partial_hours);
      const resolved = await resolveEffectiveSchedule(emp.id, b.start_date).catch(() => null);
      const basis = resolved?.dayRule?.expected_minutes > 0 ? resolved.dayRule.expected_minutes : 480;
      counted = { days: hours > 0 ? Math.max(0.01, round2(Math.min(hours * 60, basis) / basis)) : 0, excluded: [], basis: 'hours' };
    } else {
      counted = await countRequestDays(pool, { employeeId: emp.id, companyId: emp.company_id, type, start: b.start_date, end: b.end_date });
    }
    const policy = await loadLeavePolicy(pool);
    const a = await assess({ emp, type, start: b.start_date, end: b.end_date, days: counted.days, policy });
    res.json({ days: counted.days, day_basis: counted.basis, excluded: counted.excluded, ...a });
  } catch (err) { fail(res, 'POST /leave/preview', err); }
});

// ─── Approver's context ──────────────────────────────────────────────────────
// GET /api/leave/requests/:id/context — who else is off, travel documents, balance.
router.get('/requests/:id/context', async (req, res) => {
  try {
    const [[lr]] = await pool.query(
      `SELECT lr.*, DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS s, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS e
         FROM leave_requests lr WHERE lr.id = ?`, [req.params.id]);
    if (!lr) return res.status(404).json({ error: 'Request not found' });
    const [emp] = await employeesById(pool, [lr.employee_id]);

    // HR in scope, a manager above the employee, or an approver on its chain.
    let allowed = false;
    if (isHR(req)) {
      const co = companyClause(req, 'company_id');
      const [[x]] = await pool.query('SELECT id FROM leave_requests WHERE id = ?' + co.clause, [lr.id, ...co.params]);
      allowed = !!x;
    }
    if (!allowed) {
      const me = await myEmployeeId(req.user.id);
      if (me && me !== emp.id) {
        const [rows] = await pool.query('SELECT id, manager_employee_id FROM employees WHERE manager_employee_id IS NOT NULL');
        allowed = teamOf(me, rows).has(emp.id);
      }
    }
    if (!allowed) {
      const [[ar]] = await pool.query("SELECT steps FROM approval_requests WHERE process = 'leave' AND entity_id = ?", [lr.id]);
      const steps = ar ? (typeof ar.steps === 'string' ? JSON.parse(ar.steps) : ar.steps) || [] : [];
      allowed = steps.some((s) => (s.approvers || []).includes(req.user.id));
    }
    if (!allowed) return res.status(403).json({ error: 'Not yours to see' });

    // The team: people with the same manager, or else the same department.
    const [peers] = emp.manager_employee_id
      ? await pool.query('SELECT id, first_name, last_name FROM employees WHERE manager_employee_id = ? AND id <> ? AND status IN (?)', [emp.manager_employee_id, emp.id, ACTIVE])
      : emp.department_id
        ? await pool.query('SELECT id, first_name, last_name FROM employees WHERE department_id = ? AND company_id = ? AND id <> ? AND status IN (?)', [emp.department_id, emp.company_id, emp.id, ACTIVE])
        : [[]];
    let off = [];
    if (peers.length) {
      [off] = await pool.query(
        `SELECT lr.id, lr.employee_id, lr.status, lr.days, lt.name AS leave_type_name, lt.color,
                DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date
           FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.employee_id IN (?) AND lr.status IN ('Pending','Approved') AND lr.start_date <= ? AND lr.end_date >= ?
          ORDER BY lr.start_date`, [peers.map((p) => p.id), lr.e, lr.s]);
    }
    const name = new Map(peers.map((p) => [p.id, `${p.first_name || ''} ${p.last_name || ''}`.trim()]));
    const teamSize = peers.length + 1;
    let peak = 1;
    for (const d of datesBetween(lr.s, lr.e)) {
      const who = new Set(off.filter((o) => o.start_date <= d && o.end_date >= d).map((o) => o.employee_id));
      peak = Math.max(peak, who.size + 1);
    }

    // Travel documents that run out before, during or soon after the leave.
    const [docs] = await pool.query(
      `SELECT doc_type, DATE_FORMAT(expiry_date, '%Y-%m-%d') AS expiry_date FROM employee_documents
        WHERE employee_id = ? AND doc_type IN ('Passport','Residence Visa','Emirates ID')
          AND expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(?, INTERVAL 30 DAY)
        ORDER BY expiry_date`, [emp.id, lr.e]).catch(() => [[]]);
    const documents = docs.map((d) => ({
      ...d, when: d.expiry_date < lr.s ? 'before' : d.expiry_date <= lr.e ? 'during' : 'after',
    }));

    const type = await pool.query('SELECT * FROM leave_types WHERE id = ?', [lr.leave_type_id]).then(([[t]]) => t);
    const policy = await loadLeavePolicy(pool);
    const a = await assess({ emp, type, start: lr.s, end: lr.e, days: Number(lr.days), policy, excludeRequestId: lr.id });
    res.json({
      team_size: teamSize, team_basis: emp.manager_employee_id ? 'manager' : emp.department_id ? 'department' : 'none',
      peak_off: peak, peak_percent: Math.round((peak / teamSize) * 100),
      others_off: off.map((o) => ({ ...o, employee_name: name.get(o.employee_id) || '' })),
      documents, ...a,
    });
  } catch (err) { fail(res, 'GET /leave/requests/:id/context', err); }
});

// ─── Team calendar ───────────────────────────────────────────────────────────
// GET /api/leave/calendar?month=YYYY-MM — HR: everyone in scope; others: their team and themselves.
router.get('/calendar', async (req, res) => {
  try {
    const month = PERIOD_RE.test(req.query.month || '') ? req.query.month : (await todayStr()).slice(0, 7);
    const first = `${month}-01`;
    const last = new Date(Date.UTC(+month.slice(0, 4), +month.slice(5, 7), 0)).toISOString().slice(0, 10);
    let where; let params;
    let companyId = null;
    if (isHR(req)) {
      const co = companyClause(req, 'e.company_id');
      where = `e.status IN (?)${co.clause}`; params = [ACTIVE, ...co.params];
      companyId = req.companyId ?? null;
    } else {
      const me = await myEmployeeId(req.user.id);
      if (!me) return res.json({ month, employees: [], leaves: [], holidays: [] });
      const [rows] = await pool.query('SELECT id, manager_employee_id FROM employees WHERE manager_employee_id IS NOT NULL');
      const ids = [me, ...teamOf(me, rows).keys()];
      where = 'e.id IN (?)'; params = [ids];
      const [[mine]] = await pool.query('SELECT company_id FROM employees WHERE id = ?', [me]);
      companyId = mine?.company_id ?? null;
    }
    const [employees] = await pool.query(
      `SELECT e.id, TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS name, d.name AS department
         FROM employees e LEFT JOIN departments d ON d.id = e.department_id
        WHERE ${where} ORDER BY d.name, e.first_name, e.last_name`, params);
    let leaves = [];
    if (employees.length) {
      [leaves] = await pool.query(
        `SELECT lr.id, lr.employee_id, lr.status, lr.days, lt.name AS leave_type_name, lt.color,
                DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS start_date, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS end_date
           FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.employee_id IN (?) AND lr.status IN ('Pending','Approved') AND lr.start_date <= ? AND lr.end_date >= ?`,
        [employees.map((e) => e.id), last, first]);
    }
    const holidays = await holidaysBetween(companyId, first, last).catch(() => []);
    res.json({ month, employees, leaves, holidays });
  } catch (err) { fail(res, 'GET /leave/calendar', err); }
});

// GET /api/leave/requests/:id/ics — an approved leave as a calendar file.
router.get('/requests/:id/ics', async (req, res) => {
  try {
    const [[lr]] = await pool.query(
      `SELECT lr.id, lr.employee_id, lr.company_id, lr.status, lr.days, lt.name AS leave_type_name,
              DATE_FORMAT(lr.start_date, '%Y-%m-%d') AS s, DATE_FORMAT(lr.end_date, '%Y-%m-%d') AS e
         FROM leave_requests lr JOIN leave_types lt ON lt.id = lr.leave_type_id WHERE lr.id = ?`, [req.params.id]);
    if (!lr) return res.status(404).json({ error: 'Request not found' });
    if (!isHR(req) && lr.employee_id !== (await myEmployeeId(req.user.id))) return res.status(404).json({ error: 'Request not found' });
    if (lr.status !== 'Approved') return res.status(409).json({ error: 'Only approved leave goes in a calendar' });
    const ics = leaveIcs({ uid: `leave-${lr.id}@ist-hr`, title: lr.leave_type_name, start: lr.s, end: lr.e, description: `${Number(lr.days)} day(s)` });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="leave-${lr.id}.ics"`);
    res.send(ics);
  } catch (err) { fail(res, 'GET /leave/requests/:id/ics', err); }
});

// ─── The ledger ──────────────────────────────────────────────────────────────
// GET /api/leave/adjustments?employee_id=&year=
router.get('/adjustments', authorize(...HR), async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    let where = 'WHERE 1=1' + co.clause;
    const params = [...co.params];
    if (req.query.employee_id) { where += ' AND a.employee_id = ?'; params.push(req.query.employee_id); }
    if (req.query.year) { where += ' AND a.year = ?'; params.push(req.query.year); }
    if (req.query.kind) { where += ' AND a.kind = ?'; params.push(req.query.kind); }
    const [rows] = await pool.query(
      `SELECT a.*, DATE_FORMAT(a.expires_on, '%Y-%m-%d') AS expires_on, lt.name AS leave_type_name, u.name AS created_by_name,
              TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name
         FROM leave_adjustments a JOIN leave_types lt ON lt.id = a.leave_type_id
         JOIN employees e ON e.id = a.employee_id LEFT JOIN users u ON u.id = a.created_by
        ${where} ORDER BY a.year DESC, e.first_name, a.id DESC LIMIT 1000`, params);
    res.json(rows.map((r) => ({ ...r, days: Number(r.days) })));
  } catch (err) { fail(res, 'GET /leave/adjustments', err); }
});

// GET /api/leave/balances/summary?year= — every employee's remaining days per pool, for HR.
router.get('/balances/summary', authorize(...HR), async (req, res) => {
  try {
    const year = Number(req.query.year) || Number((await todayStr()).slice(0, 4));
    const co = companyClause(req, 'company_id');
    const [ids] = await pool.query(`SELECT id FROM employees WHERE status IN (?)${co.clause} ORDER BY first_name, last_name`, [ACTIVE, ...co.params]);
    const employees = await employeesById(pool, ids.map((r) => r.id));
    const policy = await loadLeavePolicy(pool);
    // Yearly pools only: per-event types (maternity, bereavement…) have no balance to carry.
    const pools = policy.types.filter((t) => !t.deducts_from_leave_type_id && t.accrual !== 'Per Event' && (t.accrual === 'Service Based' || Number(t.default_days) > 0));
    const bal = await balancesFor(pool, { employees, poolIds: pools.map((t) => t.id), year, policy });
    res.json({
      year, types: pools.map((t) => ({ id: t.id, name: t.name })),
      employees: employees
        .sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`))
        .map((e) => ({
          id: e.id, name: `${e.first_name || ''} ${e.last_name || ''}`.trim(),
          balances: Object.fromEntries(pools.map((t) => [t.id, bal.get(`${e.id}:${t.id}`)])),
        })),
    });
  } catch (err) { fail(res, 'GET /leave/balances/summary', err); }
});

// POST /api/leave/adjustments { employee_id, leave_type_id, year, kind: Opening|Adjustment, days, reason }
router.post('/adjustments', authorize(...HR), async (req, res) => {
  try {
    const v = validateAdjustment(req.body || {});
    if (v.error) return res.status(422).json({ error: v.error });
    const year = Number(req.body.year);
    if (!(year >= 2000 && year <= 2100)) return res.status(422).json({ error: 'Choose the year' });
    const emp = await scopedEmployee(req, req.body.employee_id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const type = await activeType(req.body.leave_type_id);
    if (!type) return res.status(422).json({ error: 'Choose the leave type' });
    const policy = await loadLeavePolicy(pool);
    const poolId = policy.poolByType.get(type.id) ?? type.id;
    const [r] = await pool.query('INSERT INTO leave_adjustments SET ?', {
      company_id: emp.company_id, employee_id: emp.id, leave_type_id: poolId, year,
      kind: v.data.kind, days: v.data.days, reason: v.data.reason, created_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Leave', 'Balance Adjusted',
      `${v.data.kind} ${v.data.days > 0 ? '+' : ''}${v.data.days} day(s) for employee #${emp.id} (type ${poolId}, ${year}): ${v.data.reason}`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { fail(res, 'POST /leave/adjustments', err); }
});

// DELETE /api/leave/adjustments/:id — admin. An encashment goes with its unpaid payroll item.
router.delete('/adjustments/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[a]] = await pool.query('SELECT * FROM leave_adjustments WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!a) return res.status(404).json({ error: 'Not found' });
    if (a.kind === 'Encashment' && a.payroll_adjustment_id) {
      const [[p]] = await pool.query('SELECT item_id, settlement_id FROM payroll_adjustments WHERE id = ?', [a.payroll_adjustment_id]);
      if (p && (p.item_id || p.settlement_id)) return res.status(409).json({ error: 'Already paid by payroll; it cannot be removed' });
      await pool.query('DELETE FROM payroll_adjustments WHERE id = ?', [a.payroll_adjustment_id]);
    }
    await pool.query('DELETE FROM leave_adjustments WHERE id = ?', [a.id]);
    await addAudit(pool, req.user, 'Leave', 'Balance Adjustment Removed', `${a.kind} ${a.days} day(s) for employee #${a.employee_id} (${a.year}) removed`);
    res.json({ success: true });
  } catch (err) { fail(res, 'DELETE /leave/adjustments/:id', err); }
});

// POST /api/leave/adjustments/import { csv, year, dry_run } — opening balances.
// Columns: employee (email, attendance ID or employee number), leave type, days, reason.
// Importing again replaces the imported opening balance; it does not add to it.
router.post('/adjustments/import', authorize(...HR), async (req, res) => {
  try {
    const year = Number(req.body?.year);
    if (!(year >= 2000 && year <= 2100)) return res.status(422).json({ error: 'Choose the year' });
    const { rows, errors } = parseOpeningCsv(req.body?.csv);
    if (rows.length > 5000) return res.status(422).json({ error: 'At most 5000 rows at a time' });
    const co = companyClause(req, 'company_id');
    const [emps] = await pool.query(`SELECT id, company_id, email, attendance_id FROM employees WHERE 1=1${co.clause}`, co.params);
    const byKey = new Map();
    for (const e of emps) {
      byKey.set(String(e.id), e);
      if (e.email) byKey.set(e.email.toLowerCase(), e);
      if (e.attendance_id) byKey.set(String(e.attendance_id).toLowerCase(), e);
    }
    const [types] = await pool.query("SELECT id, name, company_id FROM leave_types WHERE status = 'Active'");
    const policy = await loadLeavePolicy(pool);
    const ok = [];
    for (const r of rows) {
      const e = byKey.get(r.employee.toLowerCase());
      if (!e) { errors.push({ line: r.line, error: `Employee "${r.employee}" not found` }); continue; }
      const t = types.find((x) => x.name.toLowerCase() === r.leave_type.toLowerCase() && (x.company_id == null || x.company_id === e.company_id));
      if (!t) { errors.push({ line: r.line, error: `Leave type "${r.leave_type}" not found` }); continue; }
      ok.push({ ...r, employee_id: e.id, company_id: e.company_id, leave_type_id: policy.poolByType.get(t.id) ?? t.id });
    }
    errors.sort((a, b) => a.line - b.line);
    if (req.body?.dry_run || errors.length) return res.json({ ready: ok.length, errors, imported: 0 });
    for (const r of ok) {
      await pool.query(
        `INSERT INTO leave_adjustments (company_id, employee_id, leave_type_id, year, kind, days, reason, source_year, created_by)
         VALUES (?, ?, ?, ?, 'Opening', ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE days = VALUES(days), reason = VALUES(reason), created_by = VALUES(created_by)`,
        [r.company_id, r.employee_id, r.leave_type_id, year, r.days, (r.reason || 'Opening balance (import)').slice(0, 500), year, req.user.id]);
    }
    await addAudit(pool, req.user, 'Leave', 'Opening Balances Imported', `${ok.length} opening balance(s) for ${year}`);
    res.json({ ready: ok.length, errors: [], imported: ok.length });
  } catch (err) { fail(res, 'POST /leave/adjustments/import', err); }
});

// POST /api/leave/carry-forward { from_year, dry_run } — unused days into the next year,
// for the types that allow it. Running it again recalculates (late approvals and all).
router.post('/carry-forward', authorize(...HR), async (req, res) => {
  try {
    const from = Number(req.body?.from_year);
    if (!(from >= 2000 && from <= 2100)) return res.status(422).json({ error: 'Choose the year' });
    const to = from + 1;
    const [types] = await pool.query(
      `SELECT id, name, carry_forward_max, carry_forward_expiry_months FROM leave_types
        WHERE status = 'Active' AND deducts_from_leave_type_id IS NULL AND (carry_forward_max IS NULL OR carry_forward_max > 0)`);
    if (!types.length) return res.json({ from_year: from, rows: [], note: 'no_types' });
    const co = companyClause(req, 'company_id');
    const [ids] = await pool.query(`SELECT id FROM employees WHERE status IN (?)${co.clause}`, [ACTIVE, ...co.params]);
    const employees = await employeesById(pool, ids.map((r) => r.id));
    const policy = await loadLeavePolicy(pool);
    const bal = await balancesFor(pool, { employees, poolIds: types.map((t) => t.id), year: from, policy });
    const out = [];
    for (const e of employees) {
      for (const t of types) {
        const b = bal.get(`${e.id}:${t.id}`);
        if (!b || b.remaining == null) continue;
        const days = carryForwardDays(b.remaining, t.carry_forward_max == null ? null : Number(t.carry_forward_max));
        out.push({ employee_id: e.id, employee_name: `${e.first_name || ''} ${e.last_name || ''}`.trim(), leave_type_id: t.id,
          leave_type_name: t.name, remaining: b.remaining, days, expires_on: carryExpiry(to, t.carry_forward_expiry_months) });
        if (req.body?.dry_run) continue;
        if (days > 0) {
          await pool.query(
            `INSERT INTO leave_adjustments (company_id, employee_id, leave_type_id, year, kind, days, reason, expires_on, source_year, created_by)
             VALUES (?, ?, ?, ?, 'Carry Forward', ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE days = VALUES(days), expires_on = VALUES(expires_on), created_by = VALUES(created_by)`,
            [e.company_id, e.id, t.id, to, days, `Unused ${t.name} carried from ${from}`, carryExpiry(to, t.carry_forward_expiry_months), from, req.user.id]);
        } else {
          await pool.query("DELETE FROM leave_adjustments WHERE employee_id = ? AND leave_type_id = ? AND year = ? AND kind = 'Carry Forward' AND source_year = ?",
            [e.id, t.id, to, from]);
        }
      }
    }
    if (!req.body?.dry_run) {
      await addAudit(pool, req.user, 'Leave', 'Carried Forward', `${out.filter((r) => r.days > 0).length} balance(s) carried from ${from} to ${to}`);
    }
    res.json({ from_year: from, rows: out.filter((r) => r.days > 0 || r.remaining > 0) });
  } catch (err) { fail(res, 'POST /leave/carry-forward', err); }
});

// POST /api/leave/lapse { year, dry_run } — carried days not used by their expiry date.
router.post('/lapse', authorize(...HR), async (req, res) => {
  try {
    const year = Number(req.body?.year);
    if (!(year >= 2000 && year <= 2100)) return res.status(422).json({ error: 'Choose the year' });
    const co = companyClause(req, 'a.company_id');
    const [carried] = await pool.query(
      `SELECT a.*, DATE_FORMAT(a.expires_on, '%Y-%m-%d') AS exp, lt.name AS leave_type_name,
              TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name
         FROM leave_adjustments a JOIN leave_types lt ON lt.id = a.leave_type_id JOIN employees e ON e.id = a.employee_id
        WHERE a.year = ? AND a.kind = 'Carry Forward' AND a.expires_on IS NOT NULL AND a.expires_on < CURDATE()${co.clause}`,
      [year, ...co.params]);
    const policy = await loadLeavePolicy(pool);
    const out = [];
    for (const c of carried) {
      const [[u]] = await pool.query(
        `SELECT COALESCE(SUM(days), 0) AS days FROM leave_requests
          WHERE employee_id = ? AND status = 'Approved' AND leave_type_id IN (?) AND YEAR(start_date) = ? AND start_date <= ?`,
        [c.employee_id, typesOfPool(policy, c.leave_type_id), year, c.exp]);
      const days = lapsedDays(c.days, u.days);
      out.push({ employee_name: c.employee_name, leave_type_name: c.leave_type_name, carried: Number(c.days), used_by_expiry: Number(u.days), lapsed: days, expires_on: c.exp });
      if (req.body?.dry_run) continue;
      if (days > 0) {
        await pool.query(
          `INSERT INTO leave_adjustments (company_id, employee_id, leave_type_id, year, kind, days, reason, source_year, created_by)
           VALUES (?, ?, ?, ?, 'Lapse', ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE days = VALUES(days), created_by = VALUES(created_by)`,
          [c.company_id, c.employee_id, c.leave_type_id, year, -days, `Carried ${c.leave_type_name} not used by ${c.exp}`, c.source_year, req.user.id]);
      } else {
        await pool.query("DELETE FROM leave_adjustments WHERE employee_id = ? AND leave_type_id = ? AND year = ? AND kind = 'Lapse' AND source_year = ?",
          [c.employee_id, c.leave_type_id, year, c.source_year]);
      }
    }
    if (!req.body?.dry_run) await addAudit(pool, req.user, 'Leave', 'Carried Days Lapsed', `${out.filter((r) => r.lapsed > 0).length} lapse(s) for ${year}`);
    res.json({ year, rows: out });
  } catch (err) { fail(res, 'POST /leave/lapse', err); }
});

// POST /api/leave/encash { employee_id, leave_type_id, year, days, period, reason }
// Pays unused days at basic / 30 through the payroll of `period`.
router.post('/encash', authorize(...HR), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const days = round2(b.days);
    const year = Number(b.year);
    const reason = String(b.reason || '').trim();
    if (!(days > 0)) return res.status(422).json({ error: 'Enter the number of days' });
    if (!(year >= 2000 && year <= 2100)) return res.status(422).json({ error: 'Choose the year' });
    if (!PERIOD_RE.test(b.period || '')) return res.status(422).json({ error: 'Choose the payroll month' });
    if (reason.length < 3) return res.status(422).json({ error: 'Give a reason' });
    const emp = await scopedEmployee(req, b.employee_id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    if (!(Number(emp.basic_salary) > 0)) return res.status(422).json({ error: 'The employee has no basic salary on record' });
    const type = await activeType(b.leave_type_id);
    if (!type) return res.status(422).json({ error: 'Choose the leave type' });
    const policy = await loadLeavePolicy(pool);
    const poolId = policy.poolByType.get(type.id) ?? type.id;
    const bal = (await balancesFor(pool, { employees: [emp], poolIds: [poolId], year, policy })).get(`${emp.id}:${poolId}`);
    if (bal.remaining == null) return res.status(422).json({ error: 'This leave type has no balance to encash' });
    if (days > bal.remaining) return res.status(422).json({ error: `Only ${bal.remaining} day(s) remain` });
    const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE company_id = ? AND period = ?', [emp.company_id, b.period]);
    if (run && run.status !== 'Draft') return res.status(409).json({ error: `Payroll for ${b.period} is already ${run.status}; choose a later month` });
    const [[poolType]] = await pool.query('SELECT name FROM leave_types WHERE id = ?', [poolId]);
    const amount = encashmentAmount(emp.basic_salary, days);

    await conn.beginTransaction();
    const [adj] = await conn.query('INSERT INTO payroll_adjustments SET ?', {
      company_id: emp.company_id, employee_id: emp.id, period: b.period, kind: 'earning', category: 'Leave Encashment',
      label: `Leave encashment: ${days} day(s) of ${poolType.name} (${year})`.slice(0, 150), amount,
      note: reason.slice(0, 500), created_by: req.user.id,
    });
    await conn.query('INSERT INTO leave_adjustments SET ?', {
      company_id: emp.company_id, employee_id: emp.id, leave_type_id: poolId, year, kind: 'Encashment', days: -days,
      reason: reason.slice(0, 500), payroll_adjustment_id: adj.insertId, created_by: req.user.id,
    });
    await conn.commit();
    await addAudit(pool, req.user, 'Leave', 'Encashed', `${days} day(s) of ${poolType.name} ${year} for employee #${emp.id}: ${amount} in ${b.period} payroll`);
    res.status(201).json({ amount, needs_regenerate: !!run });
  } catch (err) { await conn.rollback().catch(() => {}); fail(res, 'POST /leave/encash', err); }
  finally { conn.release(); }
});

export default router;
