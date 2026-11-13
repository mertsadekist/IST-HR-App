import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { requireModule, MODULES } from '../config/permissions.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause } from '../middleware/tenant.js';
import { calculateEOSB } from '../services/eosbService.js';
import { getEmployeeHoldings, buildClearance } from '../services/holdingsService.js';
import { buildSettlement } from '../services/settlementService.js';
import { loadLeavePolicy } from '../services/leavePolicyService.js';
import { notifyRole } from '../services/notificationService.js';
import { overtimePay, effectiveRates } from '../services/overtimeService.js';
import { getAppSetting } from '../services/appSettings.js';

const router = Router();
// Module-gated so reads are refused too, not just writes.
// See config/permissions.js and docs/roles_and_permissions.md.
router.use(auth, tenantScope, requireModule(MODULES.HR));

async function offboardingStepCompany(stepId) {
  const [[row]] = await pool.query(
    `SELECT obr.company_id FROM offboarding_steps s
     JOIN offboarding_records obr ON s.offboarding_id = obr.id WHERE s.id = ?`, [stepId]);
  return row?.company_id;
}
async function offboardingChecklistCompany(itemId) {
  const [[row]] = await pool.query(
    `SELECT obr.company_id FROM offboarding_checklist_items ci
     JOIN offboarding_steps s ON ci.step_id = s.id
     JOIN offboarding_records obr ON s.offboarding_id = obr.id WHERE ci.id = ?`, [itemId]);
  return row?.company_id;
}
const canActOnCompany = (req, companyId) =>
  companyId !== undefined && (req.companyId == null || Number(companyId) === req.companyId);

// GET /api/offboarding?status=X (scoped)
router.get('/', async (req, res) => {
  try {
    const co = companyClause(req, 'ob.company_id');
    let sql = `SELECT ob.*, e.first_name, e.last_name, e.email,
               c.name as company_name, c.short_code, c.color_primary,
               d.name as department_name
               FROM offboarding_records ob
               JOIN employees e ON ob.employee_id = e.id
               LEFT JOIN companies c ON ob.company_id = c.id
               LEFT JOIN departments d ON e.department_id = d.id WHERE 1=1` + co.clause;
    const params = [...co.params];
    if (req.query.status) { sql += ' AND ob.status = ?'; params.push(req.query.status); }
    sql += ' ORDER BY ob.started_at DESC';
    const [rows] = await pool.query(sql, params);

    for (const ob of rows) {
      const [[stepCount]] = await pool.query('SELECT COUNT(*) as total, SUM(status = "Complete") as done FROM offboarding_steps WHERE offboarding_id = ?', [ob.id]);
      ob.total_steps = stepCount.total;
      ob.completed_steps = stepCount.done || 0;
      ob.progress = stepCount.total > 0 ? Math.round((stepCount.done / stepCount.total) * 100) : 0;
    }
    res.json(rows);
  } catch (err) { console.error('GET /offboarding error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/offboarding/:id (scoped)
router.get('/:id', async (req, res) => {
  try {
    const co = companyClause(req, 'ob.company_id');
    const [records] = await pool.query(`SELECT ob.*, e.first_name, e.last_name, e.email, e.phone, e.start_date, e.basic_salary, e.full_salary,
      c.name as company_name, c.short_code FROM offboarding_records ob
      JOIN employees e ON ob.employee_id = e.id LEFT JOIN companies c ON ob.company_id = c.id WHERE ob.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!records.length) return res.status(404).json({ error: 'Not found' });

    const [steps] = await pool.query('SELECT * FROM offboarding_steps WHERE offboarding_id = ? ORDER BY step_number', [req.params.id]);
    for (const step of steps) {
      const [items] = await pool.query('SELECT * FROM offboarding_checklist_items WHERE step_id = ? ORDER BY sort_order', [step.id]);
      step.checklist_items = items;
    }
    res.json({ ...records[0], steps });
  } catch (err) { console.error('GET /offboarding/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// GET /api/offboarding/:id/clearance — the return-and-revoke checklist
//
// The PRD's offboarding workflow asks for one: physical items pending return,
// digital access pending revoke, and the exceptions closed with an audit trail.
// Assembled across all four asset modules, because "what does this person still
// have?" used to mean opening four screens and trusting nobody forgot one — and
// this is the question that has to be answered before a final settlement is paid.
//
// Nothing here is auto-actioned. Collecting a laptop and revoking a Meta admin
// seat are physical acts someone performs and confirms; marking them done on a
// date would be the system lying about what it has recovered.
router.get('/:id/clearance', async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[rec]] = await pool.query(
      'SELECT id, employee_id, company_id FROM offboarding_records WHERE id = ?' + co.clause,
      [req.params.id, ...co.params]);
    if (!rec) return res.status(404).json({ error: 'Not found' });

    const holdings = await getEmployeeHoldings(pool, rec.employee_id);
    res.json({ offboarding_id: rec.id, employee_id: rec.employee_id, ...buildClearance(holdings) });
  } catch (err) {
    console.error('GET /offboarding/:id/clearance error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Final settlement ────────────────────────────────────────────────────────
// Draft → Approved → Paid. Paid is final: the person is already off the monthly
// payroll, and a settlement can be paid once. See services/settlementService.js.

async function loadRecord(req, id) {
  const co = companyClause(req, 'ob.company_id');
  const [[rec]] = await pool.query(
    `SELECT ob.*, DATE_FORMAT(ob.last_working_day, '%Y-%m-%d') AS lwd,
            e.first_name, e.last_name, e.basic_salary AS emp_basic, e.full_salary AS emp_full,
            DATE_FORMAT(e.start_date, '%Y-%m-%d') AS emp_start
       FROM offboarding_records ob JOIN employees e ON e.id = ob.employee_id
      WHERE ob.id = ?` + co.clause, [id, ...co.params]);
  return rec || null;
}

const parseInputs = (rec) => {
  if (!rec.settlement_inputs) return {};
  try { return typeof rec.settlement_inputs === 'string' ? JSON.parse(rec.settlement_inputs) : rec.settlement_inputs; }
  catch { return {}; }
};

/** Reads everything the calculation needs and runs it. */
async function computeSettlement(db, rec, hrInputs) {
  // Last month an approved monthly run paid this person.
  const [[paid]] = await db.query(
    `SELECT MAX(pr.period) AS period FROM payroll_items pi JOIN payroll_runs pr ON pr.id = pi.run_id
      WHERE pi.employee_id = ? AND pr.status IN ('Approved','Paid')`, [rec.employee_id]);

  // Annual leave taken in the leaving year (types drawing on the annual pool too).
  const policy = await loadLeavePolicy(db);
  const annualTypes = policy.annualTypeId
    ? [...policy.poolByType].filter(([, pool]) => pool === policy.annualTypeId).map(([type]) => type).concat(policy.annualTypeId)
    : [];
  let taken = 0;
  if (annualTypes.length && rec.lwd) {
    const [[t]] = await db.query(
      `SELECT COALESCE(SUM(days), 0) AS days FROM leave_requests
        WHERE employee_id = ? AND status = 'Approved' AND leave_type_id IN (?)
          AND YEAR(start_date) = ? AND start_date <= ?`,
      [rec.employee_id, [...new Set(annualTypes)], Number(rec.lwd.slice(0, 4)), rec.lwd]);
    taken = Number(t.days) || 0;
  }

  // Outstanding loans: only approved and paid runs count as repaid.
  const [loans] = await db.query(
    `SELECT l.id, l.type, l.principal - COALESCE((SELECT SUM(r.amount) FROM loan_repayments r
                JOIN payroll_runs pr ON pr.id = r.run_id
               WHERE r.loan_id = l.id AND pr.status IN ('Approved','Paid')), 0) AS outstanding
       FROM employee_loans l WHERE l.employee_id = ? AND l.status = 'Active'`, [rec.employee_id]);

  // One-time items no monthly run ever paid.
  const [adjustments] = await db.query(
    `SELECT id, kind, label, amount FROM payroll_adjustments
      WHERE employee_id = ? AND item_id IS NULL AND (settlement_id IS NULL OR settlement_id = ?)
      ORDER BY id`, [rec.employee_id, rec.id]);

  // Approved overtime no monthly run paid, priced at today's basic and rates.
  const [otRows] = await db.query(
    `SELECT id, DATE_FORMAT(work_date, '%Y-%m-%d') AS work_date, approved_normal, approved_night, approved_rest
       FROM overtime_records
      WHERE employee_id = ? AND status = 'Approved' AND item_id IS NULL AND (settlement_id IS NULL OR settlement_id = ?)`,
    [rec.employee_id, rec.id]);
  const otRates = effectiveRates(await getAppSetting('overtime_rates'));
  const overtime = otRows.map((o) => {
    const p = overtimePay({ normal_minutes: o.approved_normal || 0, night_minutes: o.approved_night || 0, rest_minutes: o.approved_rest || 0 },
      rec.emp_basic, otRates);
    return { id: o.id, amount: p.amount, explanation: `${o.work_date}: ${p.explanation}` };
  });

  const [manual] = await db.query(
    `SELECT id, kind, label, amount, explanation FROM offboarding_settlement_lines
      WHERE offboarding_id = ? AND source = 'manual' ORDER BY sort_order, id`, [rec.id]);

  return buildSettlement({
    employee: { basic_salary: rec.emp_basic, full_salary: rec.emp_full, start_date: rec.emp_start },
    lastWorkingDay: rec.lwd,
    departureType: rec.departure_type,
    lastPaidPeriod: paid?.period || null,
    unpaidLeaveDays: hrInputs.unpaid_leave_days,
    annualTakenThisYear: taken,
    carryForwardDays: hrInputs.carry_forward_days,
    leaveDaysOverride: hrInputs.leave_days_override,
    loans: loans.map((l) => ({ ...l, outstanding: Number(l.outstanding) })),
    adjustments: adjustments.map((a) => ({ ...a, amount: Number(a.amount) })),
    overtime,
    manualLines: manual.map((m) => ({ ...m, amount: Number(m.amount) })),
  });
}

/** Writes the auto lines and totals of a computed settlement onto the record. */
async function saveSettlement(db, rec, result, hrInputs, userId) {
  await db.query("DELETE FROM offboarding_settlement_lines WHERE offboarding_id = ? AND source = 'auto'", [rec.id]);
  const auto = result.lines.filter((l) => l.source === 'auto');
  if (auto.length) {
    await db.query(
      `INSERT INTO offboarding_settlement_lines
         (offboarding_id, kind, code, label, quantity, rate, amount, explanation, source, ref_id, sort_order) VALUES ?`,
      [auto.map((l) => [rec.id, l.kind, l.code, String(l.label).slice(0, 150), l.quantity, l.rate, l.amount,
        l.explanation ? String(l.explanation).slice(0, 500) : null, 'auto', l.ref_id, l.sort])]);
  }
  // Manual lines keep their place after the automatic ones.
  for (const l of result.lines.filter((x) => x.source === 'manual' && x.ref_id)) {
    await db.query('UPDATE offboarding_settlement_lines SET sort_order = ? WHERE id = ?', [l.sort, l.ref_id]);
  }
  await db.query(
    `UPDATE offboarding_records SET settlement_status = 'Draft', final_salary = ?, leave_encashment = ?,
            eosb_amount = ?, deductions = ?, total_settlement = ?, settlement_inputs = ?,
            settlement_prepared_by = ?, settlement_prepared_at = NOW()
      WHERE id = ?`,
    [result.totals.final_salary, result.totals.leave_encashment, result.totals.gratuity, result.totals.deductions,
      result.totals.net, JSON.stringify({ ...hrInputs, facts: result.facts, shortfall: result.totals.shortfall }),
      userId, rec.id]);
}

const cleanInputs = (body, prev = {}) => {
  const num = (v) => (v === '' || v == null ? null : Number(v));
  const out = { ...prev };
  for (const k of ['carry_forward_days', 'leave_days_override', 'unpaid_leave_days']) {
    if (body[k] === undefined) continue;
    const v = num(body[k]);
    if (v != null && (!Number.isFinite(v) || v < 0 || v > 3650)) return { error: `Invalid ${k.replace(/_/g, ' ')}` };
    out[k] = v;
  }
  return { inputs: out };
};

/** Things that stop a settlement being approved. */
async function settlementBlockers(rec) {
  const holdings = await getEmployeeHoldings(pool, rec.employee_id);
  const clearance = buildClearance(holdings);
  // Still on a monthly run that is not yet approved: paying both would pay the
  // same days twice. That run must be regenerated (it will leave them out).
  const [[open]] = await pool.query(
    `SELECT pr.period FROM payroll_items pi JOIN payroll_runs pr ON pr.id = pi.run_id
      WHERE pi.employee_id = ? AND pr.status IN ('Draft','Pending Approval') LIMIT 1`, [rec.employee_id]);
  return { clearance_open: clearance.cleared ? 0 : clearance.counts.total, open_run_period: open?.period || null };
}

// GET /api/offboarding/:id/settlement
router.get('/:id/settlement', async (req, res) => {
  try {
    const rec = await loadRecord(req, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    const [lines] = await pool.query(
      'SELECT * FROM offboarding_settlement_lines WHERE offboarding_id = ? ORDER BY sort_order, id', [rec.id]);
    const inputs = parseInputs(rec);
    const blockers = await settlementBlockers(rec);
    const today = new Date().toISOString().slice(0, 10);
    const due = inputs.facts?.due_date || null;
    res.json({
      offboarding_id: rec.id,
      status: rec.settlement_status,
      inputs: { carry_forward_days: inputs.carry_forward_days ?? null, leave_days_override: inputs.leave_days_override ?? null,
        unpaid_leave_days: inputs.unpaid_leave_days ?? null },
      facts: inputs.facts || null,
      lines: lines.map((l) => ({ ...l, amount: Number(l.amount), quantity: l.quantity == null ? null : Number(l.quantity),
        rate: l.rate == null ? null : Number(l.rate) })),
      totals: {
        final_salary: Number(rec.final_salary || 0), leave_encashment: Number(rec.leave_encashment || 0),
        gratuity: Number(rec.eosb_amount || 0), deductions: Number(rec.deductions || 0),
        net: Number(rec.total_settlement || 0), shortfall: Number(inputs.shortfall || 0),
      },
      due_date: due,
      overdue: !!due && rec.settlement_status !== 'Paid' && today > due,
      prepared_by: rec.settlement_prepared_by, prepared_at: rec.settlement_prepared_at,
      approved_by: rec.settlement_approved_by, approved_at: rec.settlement_approved_at,
      override_reason: rec.settlement_override_reason,
      paid_at: rec.settlement_paid_at, payment_ref: rec.settlement_payment_ref,
      blockers,
    });
  } catch (err) { console.error('GET /offboarding/:id/settlement error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/offboarding/:id/settlement/calculate — (re)calculate the Draft.
router.post('/:id/settlement/calculate', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const rec = await loadRecord(req, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    if (!['Not Started', 'Draft'].includes(rec.settlement_status)) {
      return res.status(409).json({ error: `The settlement is already ${rec.settlement_status}` });
    }
    const { inputs, error } = cleanInputs(req.body || {}, parseInputs(rec));
    if (error) return res.status(422).json({ error });
    delete inputs.facts; delete inputs.shortfall;
    const result = await computeSettlement(pool, rec, inputs);
    await saveSettlement(pool, rec, result, inputs, req.user.id);
    await addAudit(pool, req.user, 'Offboarding', 'Settlement Calculated',
      `Final settlement for ${rec.first_name} ${rec.last_name}: net ${result.totals.net.toFixed(2)}`
      + (result.totals.shortfall ? `, shortfall ${result.totals.shortfall.toFixed(2)}` : ''));
    res.json({ success: true, totals: result.totals });
  } catch (err) { console.error('POST /offboarding/:id/settlement/calculate error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/offboarding/:id/settlement/lines — a manual line (notice pay, damages…)
router.post('/:id/settlement/lines', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const rec = await loadRecord(req, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    if (rec.settlement_status !== 'Draft') return res.status(409).json({ error: 'Calculate the settlement first; only a Draft can change' });
    const { kind, label, explanation } = req.body || {};
    const amount = Math.round(Number(req.body?.amount) * 100) / 100;
    if (!['earning', 'deduction'].includes(kind)) return res.status(422).json({ error: 'Choose whether it is paid or deducted' });
    if (!String(label || '').trim()) return res.status(422).json({ error: 'A description is required' });
    if (!(amount > 0)) return res.status(422).json({ error: 'The amount must be more than zero' });
    await pool.query('INSERT INTO offboarding_settlement_lines SET ?', {
      offboarding_id: rec.id, kind, code: 'MANUAL', label: String(label).trim().slice(0, 150), amount,
      explanation: explanation ? String(explanation).trim().slice(0, 500) : null, source: 'manual', sort_order: 999,
    });
    const inputs = parseInputs(rec); delete inputs.facts; delete inputs.shortfall;
    await saveSettlement(pool, rec, await computeSettlement(pool, rec, inputs), inputs, req.user.id);
    await addAudit(pool, req.user, 'Offboarding', 'Settlement Line Added', `"${label}" ${amount.toFixed(2)} (${kind}) on the settlement of ${rec.first_name} ${rec.last_name}`);
    res.status(201).json({ success: true });
  } catch (err) { console.error('POST /offboarding/:id/settlement/lines error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// DELETE /api/offboarding/:id/settlement/lines/:lineId — admin only, like every delete.
router.delete('/:id/settlement/lines/:lineId', authorize('admin'), async (req, res) => {
  try {
    const rec = await loadRecord(req, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    if (rec.settlement_status !== 'Draft') return res.status(409).json({ error: 'Only a Draft settlement can change' });
    const [r] = await pool.query("DELETE FROM offboarding_settlement_lines WHERE id = ? AND offboarding_id = ? AND source = 'manual'",
      [req.params.lineId, rec.id]);
    if (!r.affectedRows) return res.status(404).json({ error: 'Line not found' });
    const inputs = parseInputs(rec); delete inputs.facts; delete inputs.shortfall;
    await saveSettlement(pool, rec, await computeSettlement(pool, rec, inputs), inputs, req.user.id);
    await addAudit(pool, req.user, 'Offboarding', 'Settlement Line Deleted', `Manual line removed from the settlement of ${rec.first_name} ${rec.last_name}`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /offboarding/:id/settlement/lines/:lineId error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/offboarding/:id/settlement/approve
//
// Four eyes, like payroll: whoever prepared it does not approve it (an admin can,
// with a reason). Unreturned assets and open access block approval unless an
// admin records why it goes ahead anyway. The figures are recomputed first: if
// anything moved since the Draft was prepared, the approver must look again.
router.put('/:id/settlement/approve', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const rec = await loadRecord(req, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    if (rec.settlement_status !== 'Draft') return res.status(409).json({ error: 'Only a Draft settlement can be approved' });

    const reason = String(req.body?.override_reason || '').trim();
    const isAdmin = req.user.role === 'admin';
    if (rec.settlement_prepared_by === req.user.id) {
      if (!isAdmin) return res.status(403).json({ error: 'The person who prepared the settlement cannot approve it', code: 'SAME_PERSON' });
      if (reason.length < 10) return res.status(422).json({ error: 'You prepared this settlement: give a reason of at least 10 characters to approve it yourself', code: 'SAME_PERSON' });
    }
    const blockers = await settlementBlockers(rec);
    if (blockers.open_run_period) {
      return res.status(409).json({ error: `Still in the ${blockers.open_run_period} payroll run that is not approved yet. Regenerate that run first so the same days are not paid twice.`, code: 'IN_OPEN_RUN' });
    }
    if (blockers.clearance_open) {
      if (!isAdmin) return res.status(409).json({ error: `${blockers.clearance_open} item(s) still to return or revoke`, code: 'CLEARANCE_OPEN' });
      if (reason.length < 10) return res.status(422).json({ error: 'Items are still to return or revoke: give a reason of at least 10 characters', code: 'CLEARANCE_OPEN' });
    }

    const inputs = parseInputs(rec); delete inputs.facts; delete inputs.shortfall;
    const fresh = await computeSettlement(pool, rec, inputs);
    if (Math.abs(fresh.totals.net - Number(rec.total_settlement || 0)) > 0.009
        || Math.abs(fresh.totals.deductions - Number(rec.deductions || 0)) > 0.009) {
      await saveSettlement(pool, rec, fresh, inputs, rec.settlement_prepared_by);
      return res.status(409).json({ error: 'The figures changed since the Draft was prepared. They have been recalculated: review them and approve again.', code: 'CHANGED' });
    }

    await pool.query(
      `UPDATE offboarding_records SET settlement_status = 'Approved', settlement_approved_by = ?, settlement_approved_at = NOW(),
              settlement_override_reason = ? WHERE id = ?`, [req.user.id, reason ? reason.slice(0, 500) : null, rec.id]);
    await addAudit(pool, req.user, 'Offboarding', 'Settlement Approved',
      `Final settlement for ${rec.first_name} ${rec.last_name} approved: net ${Number(rec.total_settlement).toFixed(2)}`
      + (reason ? ` — ${reason}` : ''));
    await notifyRole(pool, rec.company_id, ['admin', 'accountant'], {
      type: 'payroll', title: 'Final settlement approved',
      body: `${rec.first_name} ${rec.last_name}: ${Number(rec.total_settlement).toFixed(2)} to pay`, link: '/offboarding',
    }, req.user.id);
    res.json({ success: true });
  } catch (err) { console.error('PUT /offboarding/:id/settlement/approve error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/offboarding/:id/settlement/reopen — Approved → back to Draft, with a reason.
router.put('/:id/settlement/reopen', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(422).json({ error: 'A reason is required' });
    const rec = await loadRecord(req, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    if (rec.settlement_status !== 'Approved') return res.status(409).json({ error: 'Only an approved, unpaid settlement can be reopened' });
    await pool.query(
      `UPDATE offboarding_records SET settlement_status = 'Draft', settlement_approved_by = NULL,
              settlement_approved_at = NULL, settlement_override_reason = NULL WHERE id = ?`, [rec.id]);
    await addAudit(pool, req.user, 'Offboarding', 'Settlement Reopened', `Settlement of ${rec.first_name} ${rec.last_name} reopened: ${reason}`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /offboarding/:id/settlement/reopen error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/offboarding/:id/settlement/paid — Approved → Paid. Final.
// The outstanding loans it deducted are closed, and the one-time items it paid
// are marked so no later run picks them up.
router.put('/:id/settlement/paid', authorize('admin', 'accountant'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const rec = await loadRecord(req, req.params.id);
    if (!rec) return res.status(404).json({ error: 'Not found' });
    if (rec.settlement_status !== 'Approved') return res.status(409).json({ error: 'Only an approved settlement can be marked paid' });
    const paidAt = String(req.body?.paid_at || '').slice(0, 10);
    const ref = String(req.body?.payment_ref || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAt)) return res.status(422).json({ error: 'Enter the payment date' });
    if (!ref) return res.status(422).json({ error: 'Enter the payment reference (transfer or cheque number)' });

    const [lines] = await conn.query("SELECT code, ref_id FROM offboarding_settlement_lines WHERE offboarding_id = ? AND source = 'auto' AND ref_id IS NOT NULL", [rec.id]);
    await conn.beginTransaction();
    await conn.query(
      `UPDATE offboarding_records SET settlement_status = 'Paid', settlement_paid_at = ?, settlement_payment_ref = ?,
              settlement_paid_by = ? WHERE id = ? AND settlement_status = 'Approved'`, [paidAt, ref.slice(0, 120), req.user.id, rec.id]);
    const loanIds = lines.filter((l) => l.code === 'LOAN').map((l) => l.ref_id);
    if (loanIds.length) {
      await conn.query(
        `UPDATE employee_loans SET status = 'Settled', closed_by = ?, closed_at = NOW(), close_note = 'Deducted in the final settlement'
          WHERE id IN (?) AND status = 'Active'`, [req.user.id, loanIds]);
    }
    const adjIds = lines.filter((l) => l.code === 'ONE_TIME').map((l) => l.ref_id);
    if (adjIds.length) await conn.query('UPDATE payroll_adjustments SET settlement_id = ? WHERE id IN (?)', [rec.id, adjIds]);
    const otIds = lines.filter((l) => l.code === 'OVERTIME').map((l) => l.ref_id);
    if (otIds.length) await conn.query('UPDATE overtime_records SET settlement_id = ? WHERE id IN (?)', [rec.id, otIds]);
    await conn.commit();
    await addAudit(pool, req.user, 'Offboarding', 'Settlement Paid',
      `Final settlement for ${rec.first_name} ${rec.last_name} paid on ${paidAt} (ref ${ref}): ${Number(rec.total_settlement).toFixed(2)}`);
    res.json({ success: true });
  } catch (err) {
    try { await conn.rollback(); } catch { /* not in a transaction */ }
    console.error('PUT /offboarding/:id/settlement/paid error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally { conn.release(); }
});

// POST /api/offboarding — Initiate offboarding (employee must be in caller's company)
router.post('/', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { employee_id, departure_type, last_working_day, reason, unpaid_leave_days } = req.body;
    const eco = companyClause(req, 'company_id');
    const [[emp]] = await conn.query('SELECT * FROM employees WHERE id = ?' + eco.clause, [employee_id, ...eco.params]);
    if (!emp) { await conn.rollback(); return res.status(404).json({ error: 'Employee not found' }); }

    // Calculate EOSB via the tested engine (UAE labour-law rules + breakdown)
    const eosb = calculateEOSB({
      startDate: emp.start_date,
      lastWorkingDay: last_working_day,
      basicSalary: emp.basic_salary,
      departureType: departure_type,
      unpaidLeaveDays: Number(unpaid_leave_days) || 0,
    });
    const eosbAmount = eosb.eosb_amount;

    const [result] = await conn.query('INSERT INTO offboarding_records SET ?', {
      employee_id, company_id: emp.company_id, departure_type, last_working_day, reason,
      basic_salary: emp.basic_salary, full_salary: emp.full_salary,
      employment_start: emp.start_date, eosb_amount: eosbAmount,
      total_settlement: eosbAmount,
    });

    await conn.query('UPDATE employees SET status = ? WHERE id = ?', ['Offboarding', employee_id]);

    // Load templates and create steps
    const [templates] = await conn.query('SELECT * FROM offboarding_step_templates WHERE company_id = ? ORDER BY step_number', [emp.company_id]);
    for (const tpl of templates) {
      const [stepRes] = await conn.query('INSERT INTO offboarding_steps SET ?', {
        offboarding_id: result.insertId, step_number: tpl.step_number, name: tpl.name,
        owner: tpl.owner, sla: tpl.sla, status: tpl.step_number === 1 ? 'Open' : 'Locked',
        opened_at: tpl.step_number === 1 ? new Date() : null,
      });
      const [tplItems] = await conn.query('SELECT * FROM offboarding_step_template_items WHERE template_step_id = ? ORDER BY sort_order', [tpl.id]);
      for (const item of tplItems) {
        await conn.query('INSERT INTO offboarding_checklist_items SET ?', { step_id: stepRes.insertId, label: item.label, sort_order: item.sort_order });
      }
    }

    await conn.commit();
    await addAudit(pool, req.user, 'Offboarding', 'Initiated', `Offboarding for ${emp.first_name} ${emp.last_name}`);
    res.status(201).json({ id: result.insertId, eosb_amount: eosbAmount, eosb_breakdown: eosb });
  } catch (err) { await conn.rollback(); console.error('POST /offboarding error:', err); res.status(500).json({ error: 'Internal server error' }); }
  finally { conn.release(); }
});

// PUT /api/offboarding/steps/:stepId/complete (scoped)
router.put('/steps/:stepId/complete', authorize('admin', 'hr_manager'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const owner = await offboardingStepCompany(req.params.stepId);
    if (!canActOnCompany(req, owner)) return res.status(404).json({ error: 'Step not found' });
    await conn.beginTransaction();
    const [[step]] = await conn.query('SELECT * FROM offboarding_steps WHERE id = ?', [req.params.stepId]);
    if (!step) { await conn.rollback(); return res.status(404).json({ error: 'Step not found' }); }

    await conn.query('UPDATE offboarding_steps SET status = ?, completed_at = ? WHERE id = ?', ['Complete', new Date(), step.id]);

    const [[nextStep]] = await conn.query('SELECT * FROM offboarding_steps WHERE offboarding_id = ? AND step_number = ? AND status = ?',
      [step.offboarding_id, step.step_number + 1, 'Locked']);
    if (nextStep) await conn.query('UPDATE offboarding_steps SET status = ?, opened_at = ? WHERE id = ?', ['Open', new Date(), nextStep.id]);

    const [[remaining]] = await conn.query('SELECT COUNT(*) as cnt FROM offboarding_steps WHERE offboarding_id = ? AND status != ?', [step.offboarding_id, 'Complete']);
    if (remaining.cnt === 0) {
      await conn.query('UPDATE offboarding_records SET status = ?, completed_at = ? WHERE id = ?', ['Completed', new Date(), step.offboarding_id]);
      // The end date is the last working day HR recorded, not the day the last
      // checklist step happened to be ticked — those can be weeks apart, and the
      // attendance checks treat every working day before the end date as one the
      // person should have been in.
      const [[ob]] = await conn.query(
        "SELECT employee_id, DATE_FORMAT(last_working_day, '%Y-%m-%d') AS lwd FROM offboarding_records WHERE id = ?",
        [step.offboarding_id]);
      if (ob) {
        await conn.query('UPDATE employees SET status = ?, end_date = COALESCE(?, CURDATE()) WHERE id = ?',
          ['Exited', ob.lwd, ob.employee_id]);
      }
    }

    await conn.commit();
    res.json({ success: true });
  } catch (err) { await conn.rollback(); console.error(err); res.status(500).json({ error: 'Internal server error' }); }
  finally { conn.release(); }
});

// PUT /api/offboarding/checklist/:itemId (authz + scoped)
router.put('/checklist/:itemId', authorize('admin', 'hr_manager', 'hr_specialist'), async (req, res) => {
  try {
    const owner = await offboardingChecklistCompany(req.params.itemId);
    if (!canActOnCompany(req, owner)) return res.status(404).json({ error: 'Checklist item not found' });
    await pool.query('UPDATE offboarding_checklist_items SET is_checked = ?, checked_at = ? WHERE id = ?',
      [req.body.is_checked, req.body.is_checked ? new Date() : null, req.params.itemId]);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/offboarding/:id/generate-email — AI email template generation (authz + scoped)
router.post('/:id/generate-email', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const { template_type } = req.body; // exit_confirmation, clearance, reference, farewell
    const co = companyClause(req, 'ob.company_id');
    const [[ob]] = await pool.query(
      `SELECT ob.*, e.first_name, e.last_name, e.email, c.name as company_name
       FROM offboarding_records ob JOIN employees e ON ob.employee_id = e.id
       LEFT JOIN companies c ON ob.company_id = c.id WHERE ob.id = ?` + co.clause, [req.params.id, ...co.params]
    );
    if (!ob) return res.status(404).json({ error: 'Not found' });

    // Try AI generation
    try {
      const { default: axios } = await import('axios');
      const client = axios.create({
        baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
        headers: { 'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30000,
      });
      const templates = {
        exit_confirmation: `Write an exit confirmation email for ${ob.first_name} ${ob.last_name} leaving ${ob.company_name}. Last working day: ${ob.last_working_day}. Departure type: ${ob.departure_type}. Professional and warm tone.`,
        clearance: `Write a clearance completion email for ${ob.first_name} ${ob.last_name} from ${ob.company_name}. Include congratulations on clearance completion and final settlement details.`,
        reference: `Write a brief reference confirmation email for ${ob.first_name} ${ob.last_name} who worked at ${ob.company_name}. Professional tone.`,
        farewell: `Write a farewell email from HR on behalf of ${ob.company_name} for ${ob.first_name} ${ob.last_name}. Last working day: ${ob.last_working_day}. Warm and professional.`,
      };
      const { data } = await client.post('/chat/completions', {
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: 'You are a professional HR email writer. Write concise, well-formatted emails.' },
          { role: 'user', content: templates[template_type] || templates.exit_confirmation },
        ],
        temperature: 0.4, max_tokens: 1000,
      });
      res.json({ email: data.choices[0].message.content, template_type });
    } catch {
      // Fallback templates
      const fallbacks = {
        exit_confirmation: `Dear ${ob.first_name},\n\nThis email confirms your departure from ${ob.company_name}. Your last working day is ${ob.last_working_day}.\n\nPlease ensure all handover tasks are completed before your departure date. HR will process your final settlement within the legally mandated timeframe.\n\nWe wish you all the best in your future endeavors.\n\nBest regards,\nHR Department\n${ob.company_name}`,
        clearance: `Dear ${ob.first_name},\n\nWe are pleased to confirm that your clearance process at ${ob.company_name} has been completed successfully.\n\nYour final settlement will be processed shortly. Please contact HR if you have any questions.\n\nBest regards,\nHR Department`,
        reference: `To Whom It May Concern,\n\nThis is to confirm that ${ob.first_name} ${ob.last_name} was employed at ${ob.company_name}.\n\nFor any further inquiries, please contact our HR department.\n\nBest regards,\nHR Department\n${ob.company_name}`,
        farewell: `Dear Team,\n\nWe would like to inform you that ${ob.first_name} ${ob.last_name} will be leaving ${ob.company_name}. Their last working day is ${ob.last_working_day}.\n\nPlease join us in wishing them all the best.\n\nBest regards,\nHR Department`,
      };
      res.json({ email: fallbacks[template_type] || fallbacks.exit_confirmation, template_type, fallback: true });
    }
  } catch (err) { console.error(err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
