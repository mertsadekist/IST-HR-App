import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';
import { addAudit } from '../services/auditService.js';
import { tenantScope, companyClause, ownRecordsClause } from '../middleware/tenant.js';
import { validate } from '../middleware/validate.js';
import { computePayrollItem } from '../services/payrollService.js';
import {
  loadLeavePolicy, leaveDeductionForPeriod, annualEntitlement,
} from '../services/leavePolicyService.js';
import { buildPayrollExplanation } from '../services/payrollExplainerService.js';
import { renderPayrollExplanationWorkbook } from '../services/payrollExplainerWorkbook.js';
import { buildWpsWorkbook, wpsReadiness } from '../services/wpsService.js';
import { notify, notifyRole } from '../services/notificationService.js';
import {
  activeComponents, buildPayslipLines, groupLeaveByType, computeVariance, checkRun, loanInstalmentsFor,
} from '../services/payrollV2.js';
import { sendEmail } from '../services/emailService.js';
import { getTemplate } from '../services/emailTemplates.js';
import { overtimePay, effectiveRates } from '../services/overtimeService.js';
import { getAppSetting } from '../services/appSettings.js';

const router = Router();
router.use(auth, tenantScope);

async function myEmployeeId(userId) {
  const [[u]] = await pool.query('SELECT employee_id FROM users WHERE id = ?', [userId]);
  return u?.employee_id || null;
}

// ─── Runs ────────────────────────────────────────────────────────────────────
router.get('/runs', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [rows] = await pool.query(
      'SELECT * FROM payroll_runs WHERE 1=1' + co.clause + ' ORDER BY period DESC', co.params);
    res.json(rows);
  } catch (err) { console.error('GET /payroll/runs error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/runs/:id', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[run]] = await pool.query('SELECT * FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    const [items] = await pool.query(
      `SELECT pi.*, e.first_name, e.last_name FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id WHERE pi.run_id = ? ORDER BY e.first_name`, [run.id]);
    res.json({ ...run, items: await attachLines(items) });
  } catch (err) { console.error('GET /payroll/runs/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Payroll v2 helpers ──────────────────────────────────────────────────────

function groupBy(rows, key) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r[key])) map.set(r[key], []);
    map.get(r[key]).push(r);
  }
  return map;
}

/** Payslip line code of a one-time item (translated on the client). */
function adjustmentCode(a) {
  switch (a.category) {
    case 'Bonus': return 'BONUS';
    case 'Commission': return 'COMMISSION';
    case 'Allowance': return 'ONE_TIME_ALLOWANCE';
    case 'Reimbursement': return 'REIMBURSEMENT';
    case 'Overtime': return 'OVERTIME';
    case 'Deduction': return 'DEDUCTION';
    default: return a.kind === 'earning' ? 'ADDITION' : 'EXTRA';
  }
}

/** Adds each item's payslip lines (empty for runs generated before v2). */
async function attachLines(items) {
  if (!items.length) return items;
  const [lines] = await pool.query(
    `SELECT item_id, kind, code, label, quantity, rate, amount, explanation
       FROM payroll_item_lines WHERE item_id IN (?) ORDER BY item_id, sort_order`,
    [items.map((i) => i.id)]);
  const byItem = new Map();
  for (const l of lines) {
    if (!byItem.has(l.item_id)) byItem.set(l.item_id, []);
    byItem.get(l.item_id).push({ ...l, quantity: l.quantity == null ? null : Number(l.quantity),
      rate: l.rate == null ? null : Number(l.rate), amount: Number(l.amount) });
  }
  return items.map((i) => ({ ...i, lines: byItem.get(i.id) || [] }));
}

/** employee id → [{code, label, label_ar, amount, effective_from, effective_to}] */
async function loadComponents(db, companyId) {
  const [rows] = await db.query(
    `SELECT epc.employee_id, epc.component_code AS code, epc.amount,
            DATE_FORMAT(epc.effective_from, '%Y-%m-%d') AS effective_from,
            DATE_FORMAT(epc.effective_to, '%Y-%m-%d') AS effective_to,
            COALESCE(pct.name_en, epc.component_code) AS label, pct.name_ar AS label_ar
       FROM employee_pay_components epc
       LEFT JOIN pay_component_types pct ON pct.code = epc.component_code
      WHERE epc.company_id = ?
      ORDER BY COALESCE(pct.sort_order, 999), epc.id`, [companyId]);
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.employee_id)) map.set(r.employee_id, []);
    map.get(r.employee_id).push({ ...r, amount: Number(r.amount) });
  }
  return map;
}

/**
 * Everything the approver reads before deciding: the blocking checks, the
 * warnings, and the comparison with the last approved or paid run.
 */
async function loadRunReview(req, runId) {
  const co = companyClause(req, 'company_id');
  const [[run]] = await pool.query('SELECT * FROM payroll_runs WHERE id = ?' + co.clause, [runId, ...co.params]);
  if (!run) return null;

  const [[company]] = await pool.query('SELECT id, name, mol_id FROM companies WHERE id = ?', [run.company_id]);
  const [rawItems] = await pool.query(
    `SELECT pi.id, pi.employee_id, pi.basic_salary, pi.allowances, pi.gross, pi.deductions, pi.net,
            TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS name,
            e.work_permit_no, e.personal_no, e.labour_contract_status, e.status AS employment_status,
            b.bank_name, b.iban, b.verified AS bank_verified
       FROM payroll_items pi
       JOIN employees e ON e.id = pi.employee_id
       LEFT JOIN employee_bank_details b ON b.employee_id = e.id
      WHERE pi.run_id = ?
      ORDER BY e.first_name, e.last_name`, [run.id]);
  const items = await attachLines(rawItems);

  // The allowance breakdown in force for the period, to spot one that no longer
  // adds up to the contract (e.g. after a salary review changed full_salary).
  const periodStart = `${run.period}-01`;
  const [[{ last_day: periodEnd }]] = await pool.query("SELECT DATE_FORMAT(LAST_DAY(?), '%Y-%m-%d') last_day", [periodStart]);
  const components = await loadComponents(pool, run.company_id);
  for (const it of items) {
    const active = activeComponents(components.get(it.employee_id), periodStart, periodEnd);
    it.component_sum = active.length ? active.reduce((s, c) => s + Number(c.amount), 0) : null;
  }

  // Compared against what was actually paid: the latest earlier run that got
  // as far as approval.
  const [[prevRun]] = await pool.query(
    `SELECT id, period FROM payroll_runs
      WHERE company_id = ? AND period < ? AND status IN ('Approved','Paid')
      ORDER BY period DESC LIMIT 1`, [run.company_id, run.period]);
  let prevItems = [];
  if (prevRun) {
    const [rows] = await pool.query(
      `SELECT pi.id, pi.employee_id, pi.gross, pi.deductions, pi.net,
              TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS name
         FROM payroll_items pi JOIN employees e ON e.id = pi.employee_id
        WHERE pi.run_id = ?`, [prevRun.id]);
    prevItems = await attachLines(rows);
  }

  const variance = computeVariance(items, prevItems);
  const checks = checkRun({ items, company, variance });
  return { run, company, items, variance, checks, previous: prevRun || null };
}

const reviewSummary = (review) => ({
  run_id: review.run.id,
  period: review.run.period,
  status: review.run.status,
  previous_period: review.previous?.period || null,
  errors: review.checks.errors,
  warnings: review.checks.warnings,
  ok: review.checks.ok,
  variance: review.variance,
});

// GET /api/payroll/runs/:id/review — checks, warnings and month-on-month variance.
router.get('/runs/:id/review', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const review = await loadRunReview(req, req.params.id);
    if (!review) return res.status(404).json({ error: 'Payroll run not found' });
    res.json(reviewSummary(review));
  } catch (err) { console.error('GET /payroll/runs/:id/review error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/payroll/runs/:id/submit — Draft → Pending Approval.
//
// Blocking checks run here: a missing IBAN or work permit for someone paid
// through WPS, an invalid IBAN, no salary. Only an admin can push past them, and
// only with a written reason that stays on the run and in the audit trail.
router.put('/runs/:id/submit', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const review = await loadRunReview(req, req.params.id);
    if (!review) return res.status(404).json({ error: 'Payroll run not found' });
    const { run } = review;
    if (run.status !== 'Draft') return res.status(409).json({ error: `Run is already ${run.status}` });
    if (!review.items.length) return res.status(409).json({ error: 'This payroll run has no employees' });

    const override = String(req.body?.override_reason || '').trim();
    if (!review.checks.ok) {
      if (!override) {
        return res.status(422).json({ error: 'The run has blocking problems', code: 'CHECKS_FAILED', ...reviewSummary(review) });
      }
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only an admin can submit past blocking checks' });
      if (override.length < 10) return res.status(422).json({ error: 'Give a reason of at least 10 characters for the override' });
    }

    await pool.query(
      `UPDATE payroll_runs SET status = 'Pending Approval', submitted_by = ?, submitted_at = NOW(),
              check_override_reason = ?, rejected_by = NULL, rejected_at = NULL, rejection_reason = NULL
        WHERE id = ?`, [req.user.id, review.checks.ok ? null : override.slice(0, 500), run.id]);
    await addAudit(pool, req.user, 'Payroll', 'Submitted',
      `Payroll run #${run.id} (${run.period}) submitted for approval`
      + (review.checks.warnings.length ? `; ${review.checks.warnings.length} warning(s)` : '')
      + (review.checks.ok ? '' : `; ${review.checks.errors.length} blocking problem(s) overridden: ${override}`));
    await notifyRole(pool, run.company_id, ['admin', 'hr_manager', 'accountant'], {
      type: 'payroll', title: 'Payroll waiting for approval',
      body: `Payroll ${run.period}: ${review.items.length} employee(s), net ${Number(run.total_net).toFixed(2)}`,
      link: '/payroll-runs',
    }, req.user.id);
    res.json({ success: true, warnings: review.checks.warnings.length });
  } catch (err) { console.error('PUT /payroll/runs/:id/submit error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// PUT /api/payroll/runs/:id/reject — Pending Approval → back to Draft, with a reason.
router.put('/runs/:id/reject', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(422).json({ error: 'A reason is required' });
    const co = companyClause(req, 'company_id');
    const [[run]] = await pool.query('SELECT id, period, status, company_id, submitted_by FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'Pending Approval') return res.status(409).json({ error: 'Only a run waiting for approval can be sent back' });
    await pool.query(
      `UPDATE payroll_runs SET status = 'Draft', rejected_by = ?, rejected_at = NOW(), rejection_reason = ?,
              submitted_by = NULL, submitted_at = NULL, check_override_reason = NULL
        WHERE id = ?`, [req.user.id, reason.slice(0, 500), run.id]);
    await addAudit(pool, req.user, 'Payroll', 'Rejected', `Payroll run #${run.id} (${run.period}) sent back: ${reason}`);
    if (run.submitted_by && run.submitted_by !== req.user.id) {
      await notify(pool, { userId: run.submitted_by, companyId: run.company_id, type: 'warning',
        title: `Payroll ${run.period} sent back`, body: reason, link: '/payroll-runs' });
    }
    res.json({ success: true });
  } catch (err) { console.error('PUT /payroll/runs/:id/reject error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Generate a payroll run for a period, pulling unpaid-leave and absence deductions.
router.post('/runs/generate', authorize('admin', 'hr_manager', 'accountant'), validate({
  period: { required: true, type: 'string', pattern: /^\d{4}-\d{2}$/ },
}), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { period } = req.body;
    const companyId = req.companyId;
    if (companyId == null) return res.status(400).json({ error: 'A specific company is required to generate payroll' });

    // One run per company+period; regenerate only allowed while Draft.
    const [[existing]] = await conn.query('SELECT id, status FROM payroll_runs WHERE company_id = ? AND period = ?', [companyId, period]);
    if (existing && existing.status !== 'Draft') {
      // Released once, by the finally below.
      return res.status(409).json({ error: `A ${existing.status} payroll run already exists for ${period}` });
    }

    await conn.beginTransaction();

    let runId;
    if (existing) {
      runId = existing.id;
      await conn.query('DELETE FROM payroll_items WHERE run_id = ?', [runId]);
    } else {
      const [r] = await conn.query('INSERT INTO payroll_runs SET ?', { company_id: companyId, period, status: 'Draft', created_by: req.user.id });
      runId = r.insertId;
    }

    // Employees on the monthly payroll. Offboarding and Exited staff are
    // excluded: once offboarding starts they are handled through the final
    // settlement, and leaving them here paid a full month to people who had
    // already left. Their earned final period is a settlement matter, not a
    // monthly-payroll one — see the note in offboarding.
    const [employees] = await conn.query(
      "SELECT id, first_name, last_name, basic_salary, full_salary, is_owner, "
      + "DATE_FORMAT(start_date, '%Y-%m-%d') start_date "
      + "FROM employees WHERE company_id = ? AND status IN ('Active','Onboarding')",
      [companyId]
    );

    // `period` is validated as YYYY-MM by the route, so these are always real.
    const periodStart = `${period}-01`;
    const year = Number(period.slice(0, 4));
    const [[{ last_day: periodEndDate }]] = await conn.query(
      "SELECT DATE_FORMAT(LAST_DAY(?), '%Y-%m-%d') last_day", [periodStart]);

    // The pay tiers, the pools types draw on, and the yearly caps — loaded once
    // for the whole run rather than per employee.
    const policy = await loadLeavePolicy(conn);
    const typeNames = new Map((policy.types || []).map((t) => [t.id, t.name]));

    // Allowance breakdowns (housing, transport…) for everyone in the company,
    // loaded once. They label the payslip lines; they never change gross.
    const componentsByEmployee = await loadComponents(conn, companyId);

    // One-time items for the month not paid by any existing payroll item. When a
    // Draft run is regenerated or deleted its items go, item_id is cleared by the
    // foreign key, and the one-time items become available again.
    const [adjRows] = await conn.query(
      `SELECT id, employee_id, kind, category, label, amount, note FROM payroll_adjustments
        WHERE company_id = ? AND period = ? AND item_id IS NULL AND settlement_id IS NULL
        ORDER BY id`, [companyId, period]);
    const adjustmentsByEmployee = groupBy(adjRows, 'employee_id');

    // Active loans with what earlier runs already took. This run's own
    // repayments went with its old items, so they are not counted twice.
    const [loanRows] = await conn.query(
      `SELECT l.id, l.employee_id, l.type, l.principal, l.instalment, l.start_period, l.status,
              COALESCE((SELECT SUM(r.amount) FROM loan_repayments r
                         JOIN payroll_runs pr ON pr.id = r.run_id
                        WHERE r.loan_id = l.id AND pr.status <> 'Cancelled' AND r.run_id <> ?), 0) AS repaid
         FROM employee_loans l
        WHERE l.company_id = ? AND l.status = 'Active'`, [runId, companyId]);
    const loansByEmployee = groupBy(loanRows, 'employee_id');

    // Approved overtime up to the end of this month that no run or settlement
    // has paid yet (a late approval of last month's overtime is paid now).
    const [otRows] = await conn.query(
      `SELECT id, employee_id, approved_normal, approved_night, approved_rest FROM overtime_records
        WHERE company_id = ? AND status = 'Approved' AND item_id IS NULL AND settlement_id IS NULL AND work_date <= ?`,
      [companyId, periodEndDate]);
    const overtimeByEmployee = groupBy(otRows, 'employee_id');
    const otRates = effectiveRates(await getAppSetting('overtime_rates'));

    let totalGross = 0, totalDeductions = 0, totalNet = 0;
    for (const emp of employees) {
      // What leave costs this period, under the company policy.
      //
      // Not a count of "unpaid" days any more, because a day is no longer simply
      // paid or unpaid: sick leave is fifteen days at full pay, thirty at half
      // and forty-five at nothing, so the rate depends on how much of the year's
      // sick leave has already gone. leaveDeductionForPeriod walks the year in
      // date order and returns the days' worth actually withheld — a half-pay day
      // contributing half a day, not one and not none.
      //
      // The whole leave year is fetched, not just this month, for that reason:
      // "the first fifteen days" is a statement about sequence, and a request
      // straddling a month end has to carry its counter across.
      const [yearLeave] = await conn.query(
        `SELECT lr.leave_type_id, lr.days,
                DATE_FORMAT(lr.start_date, '%Y-%m-%d') start_date,
                DATE_FORMAT(lr.end_date,   '%Y-%m-%d') end_date
           FROM leave_requests lr
          WHERE lr.employee_id = ? AND lr.status = 'Approved'
            AND lr.end_date >= ? AND lr.start_date <= ?
          ORDER BY lr.start_date`,
        [emp.id, `${year}-01-01`, `${year}-12-31`]);

      const capByType = new Map(policy.capByType);
      // Annual leave is capped by service, so the cap differs per employee.
      //
      // With no start date on the record there is no service to measure, and the
      // policy's full allowance is used rather than nothing. Withholding pay
      // because a date is missing from an HR record is the wrong direction to
      // fail in — a long-serving employee whose start date was never entered
      // would otherwise lose their whole annual entitlement silently.
      if (policy.annualTypeId) {
        capByType.set(policy.annualTypeId, emp.start_date
          ? annualEntitlement(emp.start_date, periodEndDate)
          : policy.defaultDaysByType.get(policy.annualTypeId) ?? null);
      }
      // A company owner keeps their own hours and is never charged for leave or
      // absence: no requests are fed to the leave calculation and the absence
      // count below is skipped. Their salary line is unchanged.
      const leaveCost = leaveDeductionForPeriod({
        requests: emp.is_owner ? [] : yearLeave,
        tiersByType: policy.tiersByType,
        poolByType: policy.poolByType,
        capByType,
        periodStart,
        periodEnd: periodEndDate,
        typeNames,
      });
      const ul = { days: leaveCost.deduction_days };

      // Absence days that are NOT already accounted for by approved leave.
      //
      // The two figures were computed independently and neither excluded the
      // other, so a day that was both an 'Absent' attendance row and inside an
      // approved unpaid leave was deducted twice — once here and once above.
      //
      // The exclusion is on ANY approved leave, not only unpaid, which closes a
      // second hole: a day of approved PAID leave that carried an 'Absent' row
      // was being deducted, and a paid day must never be.
      //
      // And not on a day the employee's schedule says they do not work. The
      // fingerprint device emits a row for every registered ID every day and
      // reports "no punches" on people's rest days, which the importer stored as
      // an absence; six people were deducted a full day for a Saturday none of
      // them work. The importer no longer creates those rows, but the ones already
      // written must stop costing money, so the schedule is consulted here too.
      //
      // COALESCE(..., TRUE): no schedule resolved is not evidence of a rest day,
      // so the absence still counts. Failing the other way would quietly stop
      // deducting for anyone whose schedule was never set up.
      const [[ab]] = emp.is_owner ? [[{ days: 0 }]] : await conn.query(
        `SELECT COUNT(*) days FROM attendance a
          WHERE a.employee_id = ? AND a.status = 'Absent'
            AND DATE_FORMAT(a.work_date, '%Y-%m') = ?
            AND NOT EXISTS (
              SELECT 1 FROM leave_requests lr
               WHERE lr.employee_id = a.employee_id AND lr.status = 'Approved'
                 AND a.work_date BETWEEN lr.start_date AND lr.end_date)
            AND COALESCE((
              SELECT wsd.is_working
                FROM employee_work_schedules ews
                JOIN work_schedule_days wsd
                  ON wsd.schedule_id = ews.schedule_id
                 AND wsd.weekday = DAYOFWEEK(a.work_date) - 1
               WHERE ews.employee_id = a.employee_id
                 AND ews.effective_from <= a.work_date
                 AND (ews.effective_to IS NULL OR ews.effective_to >= a.work_date)
               ORDER BY ews.effective_from DESC LIMIT 1
            ), (
              SELECT wsd.is_working
                FROM work_schedules def
                JOIN work_schedule_days wsd
                  ON wsd.schedule_id = def.id
                 AND wsd.weekday = DAYOFWEEK(a.work_date) - 1
               WHERE def.company_id = a.company_id AND def.is_default = TRUE AND def.active = TRUE
               LIMIT 1
            ), TRUE) = TRUE`,
        [emp.id, period]);

      // One-time items for this month, and this month's loan instalments.
      const adj = adjustmentsByEmployee.get(emp.id) || [];
      const instalments = loanInstalmentsFor(loansByEmployee.get(emp.id) || [], period);
      const extras = [
        ...adj.map((a) => ({ kind: a.kind, code: adjustmentCode(a), label: a.label, amount: Number(a.amount), explanation: a.note || '' })),
        ...instalments.map((i) => ({ kind: 'deduction', code: 'LOAN', label: i.type === 'Advance' ? 'Salary advance repayment' : 'Loan instalment',
          amount: i.amount, explanation: `Outstanding after this month: ${i.outstanding_after.toFixed(2)}` })),
      ];
      // Approved overtime: one payslip line, priced per day at the legal rates.
      const ot = (overtimeByEmployee.get(emp.id) || []).map((o) => ({
        id: o.id,
        ...overtimePay({ normal_minutes: o.approved_normal || 0, night_minutes: o.approved_night || 0, rest_minutes: o.approved_rest || 0 },
          emp.basic_salary, otRates),
        minutes: (o.approved_normal || 0) + (o.approved_night || 0) + (o.approved_rest || 0),
      }));
      if (ot.length) {
        const otTotal = Math.round(ot.reduce((s, o) => s + o.amount, 0) * 100) / 100;
        const otHours = Math.round(ot.reduce((s, o) => s + o.minutes, 0) / 60 * 100) / 100;
        if (otTotal > 0) {
          extras.push({ kind: 'earning', code: 'OVERTIME_PAY', label: 'Overtime', amount: otTotal,
            explanation: `${ot.length} day(s), ${otHours} h at ${ot[0].hourly_rate.toFixed(2)}/h (basic / 30 / 8) x ${otRates.normal} normal, ${otRates.night} night, ${otRates.rest} rest day` });
        }
      }
      const sumOf = (kind) => extras.filter((x) => x.kind === kind).reduce((s, x) => s + x.amount, 0);

      const calc = computePayrollItem({
        basicSalary: emp.basic_salary,
        fullSalary: emp.full_salary,
        unpaidLeaveDays: Number(ul.days) || 0,
        absenceDays: Number(ab.days) || 0,
        extraEarnings: sumOf('earning'),
        extraDeductions: sumOf('deduction'),
      });

      const [itemRes] = await conn.query('INSERT INTO payroll_items SET ?', {
        run_id: runId, company_id: companyId, employee_id: emp.id,
        basic_salary: calc.basic_salary, allowances: calc.allowances, gross: calc.gross, additions: calc.additions,
        unpaid_leave_days: calc.unpaid_leave_days, absence_days: calc.absence_days,
        deductions: calc.deductions, net: calc.net,
      });

      // Record what this item took and paid, so the loan balance and the
      // one-time items follow the run: regenerating or deleting a Draft undoes them.
      for (const i of instalments) {
        await conn.query('INSERT INTO loan_repayments SET ?',
          { loan_id: i.loan_id, run_id: runId, item_id: itemRes.insertId, period, amount: i.amount });
      }
      for (const o of ot) {
        await conn.query('UPDATE overtime_records SET item_id = ?, run_id = ?, amount = ? WHERE id = ?',
          [itemRes.insertId, runId, o.amount, o.id]);
      }
      if (adj.length) {
        await conn.query('UPDATE payroll_adjustments SET run_id = ?, item_id = ? WHERE id IN (?)',
          [runId, itemRes.insertId, adj.map((a) => a.id)]);
      }

      // The payslip, line by line: a breakdown of calc, summing to it exactly.
      const lines = buildPayslipLines({
        calc,
        components: activeComponents(componentsByEmployee.get(emp.id), periodStart, periodEndDate),
        leaveByType: groupLeaveByType(leaveCost.lines),
        extras,
      });
      if (lines.length) {
        await conn.query(
          `INSERT INTO payroll_item_lines
             (item_id, run_id, employee_id, kind, code, label, quantity, rate, amount, explanation, sort_order)
           VALUES ?`,
          [lines.map((l) => [itemRes.insertId, runId, emp.id, l.kind, l.code, String(l.label).slice(0, 150),
            l.quantity, l.rate, l.amount, l.explanation ? String(l.explanation).slice(0, 500) : null, l.sort])]);
      }
      // Gross pay on the run includes one-time earnings, so the run reads
      // gross - deductions = net.
      totalGross += calc.gross + calc.additions; totalDeductions += calc.deductions; totalNet += calc.net;
    }

    await conn.query(
      'UPDATE payroll_runs SET employee_count = ?, total_gross = ?, total_deductions = ?, total_net = ?, status = ? WHERE id = ?',
      [employees.length, totalGross, totalDeductions, totalNet, 'Draft', runId]
    );
    await conn.commit();
    await addAudit(pool, req.user, 'Payroll', 'Generated', `Payroll run ${period}: ${employees.length} employee(s), net ${totalNet.toFixed(2)}`);
    res.status(201).json({ id: runId, period, employee_count: employees.length, total_gross: totalGross, total_deductions: totalDeductions, total_net: totalNet });
  } catch (err) {
    await conn.rollback();
    console.error('POST /payroll/runs/generate error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally { conn.release(); }
});

// PUT /api/payroll/runs/:id/approve — Pending Approval → Approved.
//
// Four eyes: whoever submitted the run does not approve it. An admin who is the
// only person available can, but only with a written reason kept on the run. The
// checks run again, because data can change while a run waits.
router.put('/runs/:id/approve', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const review = await loadRunReview(req, req.params.id);
    if (!review) return res.status(404).json({ error: 'Payroll run not found' });
    const { run } = review;
    if (run.status === 'Draft') return res.status(409).json({ error: 'Submit the run for approval first', code: 'NOT_SUBMITTED' });
    if (run.status !== 'Pending Approval') return res.status(409).json({ error: `Run is already ${run.status}` });

    const selfReason = String(req.body?.self_approval_reason || '').trim();
    if (run.submitted_by === req.user.id) {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'The person who submitted the run cannot approve it', code: 'SAME_PERSON' });
      }
      if (selfReason.length < 10) {
        return res.status(422).json({ error: 'You submitted this run: give a reason of at least 10 characters to approve it yourself', code: 'SAME_PERSON' });
      }
    }
    if (!review.checks.ok && !run.check_override_reason) {
      return res.status(422).json({ error: 'The run has blocking problems', code: 'CHECKS_FAILED', ...reviewSummary(review) });
    }

    await pool.query(
      'UPDATE payroll_runs SET status = ?, approved_by = ?, approved_at = NOW(), self_approval_reason = ? WHERE id = ?',
      ['Approved', req.user.id, run.submitted_by === req.user.id ? selfReason.slice(0, 500) : null, run.id]);
    // A loan whose approved repayments now cover it is closed. Only approved
    // and paid runs count: a Draft can still be regenerated or deleted.
    await pool.query(
      `UPDATE employee_loans l SET status = 'Settled', closed_at = NOW(), close_note = 'Repaid through payroll'
        WHERE l.company_id = ? AND l.status = 'Active'
          AND l.principal <= (SELECT COALESCE(SUM(r.amount), 0) FROM loan_repayments r
                                JOIN payroll_runs pr ON pr.id = r.run_id
                               WHERE r.loan_id = l.id AND pr.status IN ('Approved', 'Paid'))`, [run.company_id]);
    await addAudit(pool, req.user, 'Payroll', 'Approved', `Payroll run #${req.params.id} approved`
      + (run.submitted_by === req.user.id ? ` by its submitter: ${selfReason}` : ''));
    await notifyRole(pool, run.company_id, ['admin', 'accountant'], { type: 'payroll', title: 'Payroll approved', body: `Payroll ${run.period} approved and ready to mark paid`, link: '/payroll-runs' }, req.user.id);
    res.json({ success: true });
  } catch (err) { console.error('PUT /payroll/runs/:id/approve error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/payroll/runs/:id/notify-payslips — tell each employee their payslip
// is ready. The email carries the totals only; the line-by-line payslip stays
// behind the login in My Salary, where it can be explained.
router.post('/runs/:id/notify-payslips', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'pr.company_id');
    const [[run]] = await pool.query(
      `SELECT pr.id, pr.period, pr.status, pr.company_id, c.name AS company_name
         FROM payroll_runs pr LEFT JOIN companies c ON c.id = pr.company_id
        WHERE pr.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (!['Approved', 'Paid'].includes(run.status)) return res.status(409).json({ error: 'Payslips can be sent once the run is approved' });

    const [rows] = await pool.query(
      `SELECT pi.basic_salary, pi.allowances, pi.deductions, pi.net,
              TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS name, e.email
         FROM payroll_items pi JOIN employees e ON e.id = pi.employee_id
        WHERE pi.run_id = ?`, [run.id]);
    const [y, m] = run.period.split('-').map(Number);
    const month = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const fmt = (n) => Number(n || 0).toFixed(2);

    let sent = 0, failed = 0;
    const noEmail = [];
    for (const r of rows) {
      if (!r.email) { noEmail.push(r.name); continue; }
      const { subject, html } = getTemplate('payslip_notification', {
        name: r.name, month, company: run.company_name,
        basic_salary: fmt(r.basic_salary), allowances: fmt(r.allowances),
        deductions: fmt(r.deductions), net_salary: fmt(r.net),
      });
      const result = await sendEmail({
        to: r.email, toName: r.name, subject, html, companyId: run.company_id,
        templateType: 'payslip_notification', relatedModule: 'Payroll', relatedId: run.id, sentBy: req.user.id,
      });
      if (result.success) sent++; else failed++;
    }
    await pool.query('UPDATE payroll_runs SET payslips_notified_at = NOW() WHERE id = ?', [run.id]);
    await addAudit(pool, req.user, 'Payroll', 'Payslips Sent',
      `Payslip emails for run #${run.id} (${run.period}): ${sent} sent, ${failed} failed, ${noEmail.length} without email`);
    res.json({ success: true, sent, failed, no_email: noEmail });
  } catch (err) { console.error('POST /payroll/runs/:id/notify-payslips error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Salary components (housing, transport…) ─────────────────────────────────
router.get('/component-types', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT code, name_en, name_ar FROM pay_component_types WHERE active = TRUE ORDER BY sort_order, code');
    res.json(rows);
  } catch (err) { console.error('GET /payroll/component-types error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

async function scopedEmployee(req, employeeId) {
  const co = companyClause(req, 'company_id');
  const [[emp]] = await pool.query(
    'SELECT id, company_id, first_name, last_name, basic_salary, full_salary FROM employees WHERE id = ?' + co.clause,
    [employeeId, ...co.params]);
  return emp || null;
}

router.get('/employees/:employeeId/components', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const emp = await scopedEmployee(req, req.params.employeeId);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const [rows] = await pool.query(
      `SELECT id, component_code, amount,
              DATE_FORMAT(effective_from, '%Y-%m-%d') AS effective_from,
              DATE_FORMAT(effective_to, '%Y-%m-%d') AS effective_to
         FROM employee_pay_components WHERE employee_id = ? ORDER BY id`, [emp.id]);
    const basic = Number(emp.basic_salary || 0);
    const full = Math.max(basic, Number(emp.full_salary || basic));
    res.json({ basic_salary: basic, full_salary: full, allowances: Math.round((full - basic) * 100) / 100,
      components: rows.map((r) => ({ ...r, amount: Number(r.amount) })) });
  } catch (err) { console.error('GET /payroll/employees/:id/components error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Replaces the whole breakdown. The contract total (full_salary) is not touched:
// changing pay goes through a salary review; this only says what it is made of.
router.put('/employees/:employeeId/components', authorize('admin', 'hr_manager'), async (req, res) => {
  let conn = null;
  try {
    const emp = await scopedEmployee(req, req.params.employeeId);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });
    const list = Array.isArray(req.body?.components) ? req.body.components : null;
    if (!list) return res.status(422).json({ error: 'components must be a list' });

    const [types] = await pool.query('SELECT code FROM pay_component_types');
    const known = new Set(types.map((t) => t.code));
    const isDate = (v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)));
    const clean = [];
    for (const c of list) {
      const amount = Number(c.amount);
      if (!known.has(c.component_code)) return res.status(422).json({ error: `Unknown component ${c.component_code}` });
      if (!Number.isFinite(amount) || amount < 0) return res.status(422).json({ error: 'Amounts must be zero or more' });
      if (!isDate(c.effective_from) || !isDate(c.effective_to)) return res.status(422).json({ error: 'Invalid date' });
      if (c.effective_from && c.effective_to && c.effective_to < c.effective_from) return res.status(422).json({ error: 'End date is before the start date' });
      clean.push([emp.id, emp.company_id, c.component_code, Math.round(amount * 100) / 100,
        c.effective_from || null, c.effective_to || null, req.user.id]);
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query('DELETE FROM employee_pay_components WHERE employee_id = ?', [emp.id]);
    if (clean.length) {
      await conn.query(
        `INSERT INTO employee_pay_components
           (employee_id, company_id, component_code, amount, effective_from, effective_to, updated_by) VALUES ?`, [clean]);
    }
    await conn.commit();
    await addAudit(pool, req.user, 'Payroll', 'Components Updated',
      `Salary breakdown of ${emp.first_name} ${emp.last_name} set: `
      + (clean.map((c) => `${c[2]} ${c[3].toFixed(2)}`).join(', ') || 'none'));
    res.json({ success: true });
  } catch (err) {
    if (conn) { try { await conn.rollback(); } catch { /* not in a transaction */ } }
    console.error('PUT /payroll/employees/:id/components error:', err);
    res.status(500).json({ error: 'Internal server error' });
  } finally { if (conn) conn.release(); }
});

// The accountant is the person who actually moves the money, so they close the
// cycle too. Deleting a run stays admin-only — that is destroying the record of
// a payment, not completing one.
router.put('/runs/:id/mark-paid', authorize('admin', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'Approved') return res.status(409).json({ error: 'Only an approved run can be marked paid' });
    await pool.query("UPDATE payroll_runs SET status = 'Paid', paid_at = NOW() WHERE id = ?", [req.params.id]);
    await addAudit(pool, req.user, 'Payroll', 'Paid', `Payroll run #${req.params.id} marked paid`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /payroll/runs/:id/mark-paid error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/runs/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'company_id');
    const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!run) return res.status(404).json({ error: 'Payroll run not found' });
    if (run.status !== 'Draft') return res.status(409).json({ error: 'Only a draft run can be deleted' });
    await pool.query('DELETE FROM payroll_runs WHERE id = ?', [req.params.id]);
    await addAudit(pool, req.user, 'Payroll', 'Deleted', `Draft payroll run #${req.params.id} deleted`);
    res.json({ success: true });
  } catch (err) { console.error('DELETE /payroll/runs/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── WPS (UAE Wage Protection System) ────────────────────────────────────────
// Loads everything the MOL salary file needs for one run: the paying company's
// establishment details and, per employee, the identifiers + bank destination.
async function loadWpsData(req, runId) {
  const co = companyClause(req, 'company_id');
  const [[run]] = await pool.query(
    'SELECT * FROM payroll_runs WHERE id = ?' + co.clause, [runId, ...co.params]);
  if (!run) return null;

  const [[company]] = await pool.query(
    `SELECT id, name, email, phone, mol_id, wps_contact_person, wps_contact_mobile,
            wps_contact_phone, wps_contact_fax, wps_contact_email
       FROM companies WHERE id = ?`, [run.company_id]);

  // Offboarding and Exited staff are filtered here as well as at generation.
  // The file is a transfer instruction to the bank, and an older run generated
  // before that rule existed must not instruct a salary transfer to somebody who
  // has left. They are reported separately so the difference is explainable.
  const [rows] = await pool.query(
    `SELECT pi.employee_id, pi.gross, pi.net, pi.absence_days, pi.unpaid_leave_days, pi.additions AS variable,
            e.first_name, e.last_name, e.work_permit_no, e.personal_no,
            e.labour_contract_status, e.status AS employment_status,
            b.bank_name, b.iban, b.verified AS bank_verified
       FROM payroll_items pi
       JOIN employees e ON pi.employee_id = e.id
       LEFT JOIN employee_bank_details b ON b.employee_id = e.id
      WHERE pi.run_id = ?
      ORDER BY e.first_name, e.last_name`, [run.id]);

  const items = rows.filter((r) => !['Offboarding', 'Exited'].includes(r.employment_status));
  const offboarding = rows
    .filter((r) => ['Offboarding', 'Exited'].includes(r.employment_status))
    .map((r) => ({ employee_id: r.employee_id, name: `${r.first_name} ${r.last_name}`.trim(), net: Number(r.net || 0), status: r.employment_status }));

  return { run, company, items, offboarding };
}

// What is still missing before the file can legitimately be submitted.
router.get('/runs/:id/wps-readiness', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const data = await loadWpsData(req, req.params.id);
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    const report = wpsReadiness(data);
    res.json({
      ...report,
      period: data.run.period,
      company_name: data.company?.name || '',
      mol_id: data.company?.mol_id || '',
      // Run figures, so the difference against the file's own total is visible
      // when someone is held back for a missing labour contract.
      employee_count: data.items.length,
      total_net: data.items.reduce((s, i) => s + Number(i.net || 0), 0),
      unverified_bank: data.items
        .filter((i) => i.labour_contract_status === 'Issued' && i.iban && !i.bank_verified)
        .map((i) => `${i.first_name} ${i.last_name}`.trim()),
      // Present in the run but dropped from the file because they are being
      // offboarded. Reported rather than hidden: their earned final period is
      // settled separately, and the file total is lower by these amounts.
      offboarding_excluded: data.offboarding,
    });
  } catch (err) { console.error('GET /payroll/runs/:id/wps-readiness error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// The salary explanation workbook: for every employee, which days reduced their
// pay, why, at what rate, and the arithmetic behind each one.
//
// Deliberately available on a Draft run. Its whole point is to be read BEFORE the
// run is approved — that is when a wrong deduction can still be fixed — and it is
// also the document HR hands to somebody asking why they were paid less.
router.get('/runs/:id/explanation', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    // Scoped like every other read of a run: the selected entity narrows it.
    const co = companyClause(req, 'company_id');
    const [[owned]] = await pool.query(
      'SELECT id FROM payroll_runs WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!owned) return res.status(404).json({ error: 'Payroll run not found' });

    const data = await buildPayrollExplanation(pool, Number(req.params.id));
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    if (!data.employees.length) return res.status(409).json({ error: 'This payroll run has no employees' });

    const buffer = await renderPayrollExplanationWorkbook(data);
    const mismatched = data.employees.filter((e) => !e.matches);
    const withDeductions = data.employees.filter((e) => e.lines.length);

    await addAudit(pool, req.user, 'Payroll', 'Explanation Export',
      `Salary explanation generated for run #${data.run.id} (${data.run.period}): `
      + `${data.employees.length} employee(s), ${withDeductions.length} with deductions`
      + (mismatched.length ? `; ${mismatched.length} do not reconcile with the stored figure` : ''));

    const fileName = `Salary-Explanation-${(data.run.company_name || 'company').replace(/[^\w-]+/g, '_')}`
      + `-${data.run.period}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    // Read by the client so it can warn before the file is even opened.
    res.setHeader('X-Reconcile-Mismatches', String(mismatched.length));
    res.setHeader('Access-Control-Expose-Headers', 'X-Reconcile-Mismatches, Content-Disposition');
    res.send(buffer);
  } catch (err) {
    console.error('GET /payroll/runs/:id/explanation error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// The submittable .xlsx. Blocked while mandatory identifiers are missing unless
// the caller explicitly asks for a draft (?force=1) to review the layout.
router.get('/runs/:id/wps-export', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const data = await loadWpsData(req, req.params.id);
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    if (!data.items.length) {
      return res.status(409).json({
        error: data.offboarding?.length
          ? 'Every employee in this run is being offboarded, so there is nobody to instruct a transfer for. Their final pay goes through the settlement.'
          : 'This payroll run has no employees',
      });
    }

    const report = wpsReadiness(data);
    const force = req.query.force === '1' || req.query.force === 'true';
    if (!report.included_count) {
      return res.status(409).json({
        error: 'No employee in this run has an issued labour contract, so the WPS file would be empty',
        ...report,
      });
    }
    if (!report.ready && !force) {
      return res.status(422).json({ error: 'WPS data is incomplete', ...report });
    }

    const { buffer, grandTotal, count, excluded } = buildWpsWorkbook({
      company: data.company, period: data.run.period, items: data.items,
    });
    const fileName = `WPS-${(data.company?.name || 'company').replace(/[^\w-]+/g, '_')}-${data.run.period}${force && !report.ready ? '-DRAFT' : ''}.xlsx`;
    // The excluded count goes in the audit trail: the file total will not match
    // the payroll run total, and that difference must be explainable later.
    await addAudit(pool, req.user, 'Payroll', 'WPS Export',
      `WPS file generated for run #${data.run.id} (${data.run.period}): ${count} employee(s), total AED ${grandTotal.toFixed(2)}`
      + (excluded.length ? `; ${excluded.length} excluded — labour contract not issued: ${excluded.map((e) => e.name).join(', ')}` : '')
      + (data.offboarding?.length ? `; ${data.offboarding.length} excluded — offboarding, settled separately: ${data.offboarding.map((e) => e.name).join(', ')}` : '')
      + (report.ready ? '' : ' — INCOMPLETE DRAFT'));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (err) { console.error('GET /payroll/runs/:id/wps-export error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// POST /api/payroll/runs/:id/wps-send — email the submittable file to the bank
// or the PRO who files it.
//
// The workbook is rebuilt here rather than uploaded from the browser: the
// server already knows how to make it, and a file that made a round trip
// through the client is a file that could have been edited on the way. What is
// sent is exactly what /wps-export would produce.
router.post('/runs/:id/wps-send', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const { to, cc, message } = req.body;
    if (!to || !/^\S+@\S+\.\S+$/.test(String(to).trim())) {
      return res.status(422).json({ error: 'A valid recipient email is required' });
    }

    const data = await loadWpsData(req, req.params.id);
    if (!data) return res.status(404).json({ error: 'Payroll run not found' });
    if (!data.items.length) return res.status(409).json({ error: 'This payroll run has no employees' });

    const report = wpsReadiness(data);
    if (!report.included_count) {
      return res.status(409).json({ error: 'No employee in this run has an issued labour contract, so the WPS file would be empty', ...report });
    }
    // An incomplete file must never leave the building by accident. Downloading
    // a draft to inspect the layout is one thing; emailing it to the bank is
    // another, so this needs the same explicit force flag.
    const force = req.body.force === true || req.body.force === '1';
    if (!report.ready && !force) {
      return res.status(422).json({ error: 'WPS data is incomplete', ...report });
    }

    const { buffer, grandTotal, count, excluded } = buildWpsWorkbook({
      company: data.company, period: data.run.period, items: data.items,
    });
    const draft = !report.ready;
    const companyName = data.company?.name || '';
    const fileName = `WPS-${(companyName || 'company').replace(/[^\w-]+/g, '_')}-${data.run.period}${draft ? '-DRAFT' : ''}.xlsx`;
    const title = `WPS salary file — ${companyName} — ${data.run.period}`;

    const summary = [
      `Period: ${data.run.period}`,
      `Employees in the file: ${count}`,
      `Total: AED ${grandTotal.toFixed(2)}`,
      data.company?.mol_id ? `MOL ID: ${data.company.mol_id}` : null,
      excluded.length ? `Excluded (labour contract not issued): ${excluded.map((e) => e.name).join(', ')}` : null,
      data.offboarding?.length ? `Excluded (offboarding, settled separately): ${data.offboarding.map((e) => e.name).join(', ')}` : null,
      draft ? 'WARNING: this file is an INCOMPLETE DRAFT and is not ready for submission.' : null,
    ].filter(Boolean).join('\n');

    const { subject, html } = getTemplate('document_delivery', {
      name: req.body.toName || '',
      title,
      message: [message, summary].filter(Boolean).join('\n\n'),
      company: companyName,
    });

    const result = await sendEmail({
      to: String(to).trim(),
      toName: req.body.toName || '',
      subject, html,
      companyId: data.run.company_id,
      templateType: 'document_delivery',
      relatedModule: 'Payroll',
      relatedId: data.run.id,
      sentBy: req.user.id,
      cc: cc ? (Array.isArray(cc) ? cc : String(cc).split(',').map((s) => s.trim()).filter(Boolean)) : undefined,
      attachments: [{
        filename: fileName,
        content: buffer,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }],
    });

    if (!result.success) return res.status(502).json({ success: false, error: result.error || 'Send failed' });

    await addAudit(pool, req.user, 'Payroll', 'WPS Sent',
      `WPS file for run #${data.run.id} (${data.run.period}) emailed to ${to}`
      + (cc ? ` (cc ${Array.isArray(cc) ? cc.join(', ') : cc})` : '')
      + `: ${count} employee(s), total AED ${grandTotal.toFixed(2)}`
      + (draft ? ' — INCOMPLETE DRAFT' : ''));

    res.json({ success: true, messageId: result.messageId, file_name: fileName, count, total: grandTotal, draft });
  } catch (err) { console.error('POST /payroll/runs/:id/wps-send error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Payslips ────────────────────────────────────────────────────────────────
// Employee's own payslips (only from approved/paid runs)
router.get('/payslips/my', async (req, res) => {
  try {
    const empId = await myEmployeeId(req.user.id);
    if (!empId) return res.json([]);
    // No company filter: this is always the caller's own payslips, and a run
    // processed under another entity is still their pay. See ownRecordsClause().
    const co = ownRecordsClause();
    let sql = `SELECT pi.*, pr.period, pr.status as run_status
               FROM payroll_items pi JOIN payroll_runs pr ON pi.run_id = pr.id
               WHERE pi.employee_id = ? AND pr.status IN ('Approved','Paid')` + co.clause;
    const params = [empId, ...co.params];
    if (req.query.period) { sql += ' AND pr.period = ?'; params.push(req.query.period); }
    sql += ' ORDER BY pr.period DESC';
    const [rows] = await pool.query(sql, params);
    // With its lines, so the employee can see how each figure was worked out.
    res.json(await attachLines(rows));
  } catch (err) { console.error('GET /payroll/payslips/my error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// HR: an employee's payslips
router.get('/payslips/:employeeId', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'pi.company_id');
    const [rows] = await pool.query(
      `SELECT pi.*, pr.period, pr.status as run_status
       FROM payroll_items pi JOIN payroll_runs pr ON pi.run_id = pr.id
       WHERE pi.employee_id = ?` + co.clause + ' ORDER BY pr.period DESC',
      [req.params.employeeId, ...co.params]);
    res.json(await attachLines(rows));
  } catch (err) { console.error('GET /payroll/payslips/:employeeId error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Loans and salary advances ───────────────────────────────────────────────
// Repaid by payroll in instalments from the start month. "Repaid" counts only
// approved and paid runs; what a Draft or a run waiting for approval has taken
// is shown separately as "in progress", because that run can still change.
const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

router.get('/loans', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'l.company_id');
    const params = [...co.params];
    let where = 'WHERE 1=1' + co.clause;
    if (req.query.employee_id) { where += ' AND l.employee_id = ?'; params.push(req.query.employee_id); }
    if (req.query.status) { where += ' AND l.status = ?'; params.push(req.query.status); }
    const [rows] = await pool.query(
      `SELECT l.*, TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name,
              COALESCE((SELECT SUM(r.amount) FROM loan_repayments r JOIN payroll_runs pr ON pr.id = r.run_id
                         WHERE r.loan_id = l.id AND pr.status IN ('Approved','Paid')), 0) AS repaid,
              COALESCE((SELECT SUM(r.amount) FROM loan_repayments r JOIN payroll_runs pr ON pr.id = r.run_id
                         WHERE r.loan_id = l.id AND pr.status IN ('Draft','Pending Approval')), 0) AS in_progress
         FROM employee_loans l JOIN employees e ON e.id = l.employee_id
        ${where}
        ORDER BY FIELD(l.status, 'Active', 'Settled', 'Cancelled'), l.created_at DESC`, params);
    res.json(rows.map((r) => ({
      ...r, principal: Number(r.principal), instalment: Number(r.instalment), repaid: Number(r.repaid),
      in_progress: Number(r.in_progress), outstanding: Math.round((Number(r.principal) - Number(r.repaid)) * 100) / 100,
    })));
  } catch (err) { console.error('GET /payroll/loans error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/loans', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const { employee_id, type = 'Loan', start_period, reason } = req.body || {};
    const principal = Math.round(Number(req.body?.principal) * 100) / 100;
    const instalment = Math.round(Number(req.body?.instalment) * 100) / 100;
    if (!['Loan', 'Advance'].includes(type)) return res.status(422).json({ error: 'Type must be Loan or Advance' });
    if (!(principal > 0)) return res.status(422).json({ error: 'The amount must be more than zero' });
    if (!(instalment > 0) || instalment > principal) return res.status(422).json({ error: 'The monthly instalment must be more than zero and not more than the amount' });
    if (!PERIOD_RE.test(String(start_period || ''))) return res.status(422).json({ error: 'Choose the first month to deduct' });
    const emp = await scopedEmployee(req, employee_id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const [r] = await pool.query('INSERT INTO employee_loans SET ?', {
      company_id: emp.company_id, employee_id: emp.id, type, principal, instalment, start_period,
      reason: reason ? String(reason).trim().slice(0, 500) : null, created_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Payroll', 'Loan Created',
      `${type} of ${principal.toFixed(2)} to ${emp.first_name} ${emp.last_name}: ${instalment.toFixed(2)} a month from ${start_period}`);
    res.status(201).json({ id: r.insertId });
  } catch (err) { console.error('POST /payroll/loans error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Close a loan early: Settled (repaid outside payroll) or Cancelled (written off).
// Instalments already taken stay where they are.
router.put('/loans/:id/close', authorize('admin', 'hr_manager'), async (req, res) => {
  try {
    const status = req.body?.status;
    const note = String(req.body?.note || '').trim();
    if (!['Settled', 'Cancelled'].includes(status)) return res.status(422).json({ error: 'Status must be Settled or Cancelled' });
    if (!note) return res.status(422).json({ error: 'A note is required' });
    const co = companyClause(req, 'company_id');
    const [[loan]] = await pool.query('SELECT id, status, employee_id FROM employee_loans WHERE id = ?' + co.clause, [req.params.id, ...co.params]);
    if (!loan) return res.status(404).json({ error: 'Loan not found' });
    if (loan.status !== 'Active') return res.status(409).json({ error: `The loan is already ${loan.status}` });
    await pool.query('UPDATE employee_loans SET status = ?, closed_by = ?, closed_at = NOW(), close_note = ? WHERE id = ?',
      [status, req.user.id, note.slice(0, 500), loan.id]);
    await addAudit(pool, req.user, 'Payroll', 'Loan Closed', `Loan #${loan.id} marked ${status}: ${note}`);
    res.json({ success: true });
  } catch (err) { console.error('PUT /payroll/loans/:id/close error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// ─── One-time pay items (bonus, commission, one-off deduction…) ──────────────
const ADJ_CATEGORIES = {
  Bonus: 'earning', Commission: 'earning', Allowance: 'earning', Reimbursement: 'earning', Overtime: 'earning',
  Deduction: 'deduction', Other: null,
};

router.get('/adjustments', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    const params = [...co.params];
    let where = 'WHERE 1=1' + co.clause;
    if (req.query.period) { where += ' AND a.period = ?'; params.push(req.query.period); }
    if (req.query.employee_id) { where += ' AND a.employee_id = ?'; params.push(req.query.employee_id); }
    const [rows] = await pool.query(
      `SELECT a.*, TRIM(CONCAT(COALESCE(e.first_name, ''), ' ', COALESCE(e.last_name, ''))) AS employee_name,
              pr.status AS run_status
         FROM payroll_adjustments a
         JOIN employees e ON e.id = a.employee_id
         LEFT JOIN payroll_items pi ON pi.id = a.item_id
         LEFT JOIN payroll_runs pr ON pr.id = pi.run_id
        ${where}
        ORDER BY a.period DESC, a.created_at DESC`, params);
    // Locked once a submitted run, or a paid final settlement, has taken it.
    res.json(rows.map((r) => ({ ...r, amount: Number(r.amount),
      locked: (!!r.run_status && r.run_status !== 'Draft') || !!r.settlement_id })));
  } catch (err) { console.error('GET /payroll/adjustments error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/adjustments', authorize('admin', 'hr_manager', 'accountant'), async (req, res) => {
  try {
    const { employee_id, period, category = 'Other', label, note } = req.body || {};
    const amount = Math.round(Number(req.body?.amount) * 100) / 100;
    if (!(category in ADJ_CATEGORIES)) return res.status(422).json({ error: 'Unknown category' });
    const kind = ADJ_CATEGORIES[category] || req.body?.kind;
    if (!['earning', 'deduction'].includes(kind)) return res.status(422).json({ error: 'Choose whether it is paid or deducted' });
    if (!PERIOD_RE.test(String(period || ''))) return res.status(422).json({ error: 'Choose the payroll month' });
    if (!(amount > 0)) return res.status(422).json({ error: 'The amount must be more than zero' });
    if (!String(label || '').trim()) return res.status(422).json({ error: 'A description is required' });
    const emp = await scopedEmployee(req, employee_id);
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    // A month already submitted or approved cannot take new items: nothing would
    // regenerate it, and the item would sit unpaid. It goes to next month instead.
    const [[run]] = await pool.query('SELECT status FROM payroll_runs WHERE company_id = ? AND period = ?', [emp.company_id, period]);
    if (run && run.status !== 'Draft') {
      return res.status(409).json({ error: `Payroll for ${period} is already ${run.status}; add it to a later month` });
    }

    const [r] = await pool.query('INSERT INTO payroll_adjustments SET ?', {
      company_id: emp.company_id, employee_id: emp.id, period, kind, category,
      label: String(label).trim().slice(0, 150), amount, note: note ? String(note).trim().slice(0, 500) : null,
      created_by: req.user.id,
    });
    await addAudit(pool, req.user, 'Payroll', 'One-time Item Added',
      `${kind === 'earning' ? 'Payment' : 'Deduction'} "${label}" ${amount.toFixed(2)} for ${emp.first_name} ${emp.last_name} in ${period}`);
    res.status(201).json({ id: r.insertId, needs_regenerate: !!run });
  } catch (err) { console.error('POST /payroll/adjustments error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

// Admin only, like every delete. An item a submitted or approved run has paid
// stays: it is part of that payment's record.
router.delete('/adjustments/:id', authorize('admin'), async (req, res) => {
  try {
    const co = companyClause(req, 'a.company_id');
    const [[adj]] = await pool.query(
      `SELECT a.id, a.label, a.amount, a.period, a.settlement_id, pr.status AS run_status
         FROM payroll_adjustments a
         LEFT JOIN payroll_items pi ON pi.id = a.item_id
         LEFT JOIN payroll_runs pr ON pr.id = pi.run_id
        WHERE a.id = ?` + co.clause, [req.params.id, ...co.params]);
    if (!adj) return res.status(404).json({ error: 'Item not found' });
    if (adj.run_status && adj.run_status !== 'Draft') {
      return res.status(409).json({ error: `Already in a ${adj.run_status} payroll run` });
    }
    if (adj.settlement_id) return res.status(409).json({ error: 'Already paid in a final settlement' });
    await pool.query('DELETE FROM payroll_adjustments WHERE id = ?', [adj.id]);
    await addAudit(pool, req.user, 'Payroll', 'One-time Item Deleted', `"${adj.label}" ${Number(adj.amount).toFixed(2)} (${adj.period}) deleted`);
    res.json({ success: true, needs_regenerate: adj.run_status === 'Draft' });
  } catch (err) { console.error('DELETE /payroll/adjustments/:id error:', err); res.status(500).json({ error: 'Internal server error' }); }
});

export default router;
