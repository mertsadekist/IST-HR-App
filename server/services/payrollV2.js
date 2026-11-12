/**
 * Payroll v2: payslip lines, run checks and month-on-month variance.
 *
 * Pure functions only, and none of them changes a figure: computePayrollItem
 * (payrollService.js) still decides gross, deductions and net. The lines here are
 * a breakdown of that decision, never a second calculation that could disagree
 * with it — earnings always sum to `gross` and deductions to `deductions`, to the
 * fils.
 */

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => round2(n).toFixed(2);

/** A change in net pay above this share of last month's net is flagged. */
export const VARIANCE_THRESHOLD = 0.10;

/** Components in force at any point of the period [periodStart, periodEnd]. */
export function activeComponents(components, periodStart, periodEnd) {
  return (components || []).filter((c) => {
    const from = c.effective_from ? String(c.effective_from).slice(0, 10) : null;
    const to = c.effective_to ? String(c.effective_to).slice(0, 10) : null;
    return (!from || from <= periodEnd) && (!to || to >= periodStart);
  });
}

/**
 * Leave deduction days grouped by leave type, from leaveDeductionForPeriod's
 * per-day lines.
 * @returns {{name:string, days:number}[]}
 */
export function groupLeaveByType(dayLines) {
  const byName = new Map();
  for (const l of dayLines || []) {
    if (!(Number(l.deduction_days) > 0)) continue;
    const name = l.leave_type_name || 'Leave';
    byName.set(name, round2((byName.get(name) || 0) + Number(l.deduction_days)));
  }
  return [...byName].map(([name, days]) => ({ name, days }));
}

/**
 * The lines of one payslip.
 *
 * @param {object} input
 * @param {object} input.calc        the result of computePayrollItem
 * @param {{code:string,label:string,amount:number}[]} [input.components]
 *        the allowance breakdown in force for the period (housing, transport…)
 * @param {{name:string,days:number}[]} [input.leaveByType]
 *        leave deduction days grouped by leave type
 * @returns {{kind:'earning'|'deduction', code:string, label:string, quantity:number|null,
 *            rate:number|null, amount:number, explanation:string, sort:number}[]}
 */
export function buildPayslipLines({ calc, components = [], leaveByType = [] }) {
  const lines = [];
  const earn = (code, label, amount, explanation = '') =>
    lines.push({ kind: 'earning', code, label, quantity: null, rate: null, amount: round2(amount), explanation });

  earn('BASIC', 'Basic salary', calc.basic_salary, 'Contractual basic salary');

  // The contract total (full_salary) stays the source of truth for gross. The
  // components only say what the allowance part is made of; whatever they do not
  // account for is shown as its own line rather than silently changing pay.
  const comps = (components || []).filter((c) => Number(c.amount) > 0);
  if (comps.length) {
    let sum = 0;
    for (const c of comps) {
      sum = round2(sum + round2(c.amount));
      earn(c.code, c.label || c.code, c.amount, 'Monthly allowance');
    }
    const rest = round2(calc.allowances - sum);
    if (rest !== 0) {
      earn('ALLOWANCE_OTHER', rest > 0 ? 'Other allowances' : 'Adjustment to contractual gross', rest,
        `Contract gross ${money(calc.gross)} - basic ${money(calc.basic_salary)} - listed allowances ${money(sum)}`);
    }
  } else if (calc.allowances > 0) {
    earn('ALLOWANCE', 'Allowances', calc.allowances, `Contract gross ${money(calc.gross)} - basic ${money(calc.basic_salary)}`);
  }

  // Deductions: one line per leave type, one for absence. Quantities come from
  // the same counts computePayrollItem used, so the lines reconcile with it.
  const ded = [];
  const grouped = (leaveByType || []).filter((l) => Number(l.days) > 0);
  const groupedDays = round2(grouped.reduce((s, l) => s + Number(l.days), 0));
  if (calc.unpaid_leave_days > 0) {
    if (grouped.length && Math.abs(groupedDays - calc.unpaid_leave_days) < 0.011) {
      for (const l of grouped) ded.push({ code: 'LEAVE', label: l.name || 'Leave', quantity: round2(l.days) });
    } else {
      ded.push({ code: 'LEAVE', label: 'Leave deduction', quantity: calc.unpaid_leave_days });
    }
  }
  if (calc.absence_days > 0) ded.push({ code: 'ABSENCE', label: 'Unexcused absence', quantity: calc.absence_days });

  const exactRate = calc.gross / 30;
  let acc = 0;
  for (const d of ded) { d.amount = round2(d.quantity * exactRate); acc = round2(acc + d.amount); }
  // Rounding each line can drift a fils from the rounded total; the last line
  // absorbs it so the payslip adds up exactly.
  if (ded.length) {
    const last = ded[ded.length - 1];
    last.amount = round2(last.amount + round2(calc.leave_absence_deduction - acc));
  }
  for (const d of ded) {
    lines.push({
      kind: 'deduction', code: d.code, label: d.label, quantity: d.quantity, rate: calc.daily_rate,
      amount: d.amount,
      explanation: `${d.quantity} day(s) x ${money(calc.daily_rate)} (gross ${money(calc.gross)} / 30)`,
    });
  }
  if (calc.extra_deductions > 0) {
    lines.push({ kind: 'deduction', code: 'EXTRA', label: 'Other deductions', quantity: null, rate: null,
      amount: round2(calc.extra_deductions), explanation: '' });
  }
  return lines.map((l, i) => ({ ...l, sort: i }));
}

/** UAE IBAN: AE + 2 check digits + 3-digit bank code + 16-digit account, mod-97 valid. */
export function isValidUaeIban(raw) {
  const iban = String(raw || '').replace(/\s+/g, '').toUpperCase();
  if (!/^AE\d{21}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const digits = rearranged.replace(/[A-Z]/g, (ch) => String(ch.charCodeAt(0) - 55));
  let rem = 0;
  for (const d of digits) rem = (rem * 10 + Number(d)) % 97;
  return rem === 1;
}

/** What moved between two payslips: by line when both have lines, else by totals. */
function lineChanges(prev, cur) {
  const key = (l) => `${l.kind}:${l.code}:${l.code === 'LEAVE' ? l.label : ''}`;
  if (prev.lines?.length && cur.lines?.length) {
    const before = new Map(prev.lines.map((l) => [key(l), l]));
    const out = [];
    for (const l of cur.lines) {
      const b = before.get(key(l));
      const was = b ? round2(b.amount) : 0;
      if (round2(l.amount) !== was) out.push({ kind: l.kind, code: l.code, label: l.label, prev: was, cur: round2(l.amount) });
      before.delete(key(l));
    }
    for (const l of before.values()) out.push({ kind: l.kind, code: l.code, label: l.label, prev: round2(l.amount), cur: 0 });
    return out;
  }
  const out = [];
  for (const [field, label, kind] of [['gross', 'Gross', 'earning'], ['deductions', 'Deductions', 'deduction']]) {
    if (round2(prev[field]) !== round2(cur[field])) {
      out.push({ kind, code: field.toUpperCase(), label, prev: round2(prev[field]), cur: round2(cur[field]) });
    }
  }
  return out;
}

/**
 * Month-on-month comparison of net pay, per employee.
 *
 * @param {object[]} items      this run: {employee_id, name, gross, deductions, net, lines?}
 * @param {object[]} prevItems  the comparison run, same shape ([] when there is none)
 * @param {number} [threshold]  share of last month's net that counts as a big change
 */
export function computeVariance(items, prevItems, threshold = VARIANCE_THRESHOLD) {
  const hasPrev = (prevItems || []).length > 0;
  const prev = new Map((prevItems || []).map((p) => [p.employee_id, p]));
  const rows = [];
  for (const it of items || []) {
    const p = prev.get(it.employee_id);
    const net = round2(it.net);
    if (!p) {
      rows.push({ employee_id: it.employee_id, name: it.name, status: 'new', prev_net: null, net,
        diff: null, pct: null, flagged: hasPrev, changes: [] });
      continue;
    }
    const prevNet = round2(p.net);
    const diff = round2(net - prevNet);
    const pct = prevNet ? round2((diff / prevNet) * 100) : null;
    const flagged = prevNet ? Math.abs(diff) / prevNet > threshold : diff !== 0;
    rows.push({
      employee_id: it.employee_id, name: it.name, status: diff === 0 ? 'same' : 'changed',
      prev_net: prevNet, net, diff, pct, flagged, changes: lineChanges(p, it),
    });
    prev.delete(it.employee_id);
  }
  for (const p of prev.values()) {
    rows.push({ employee_id: p.employee_id, name: p.name, status: 'left', prev_net: round2(p.net), net: null,
      diff: null, pct: null, flagged: false, changes: [] });
  }
  return rows;
}

/**
 * What must be fixed before a run can go for approval (errors), and what the
 * approver should look at (warnings).
 *
 * @param {object} input
 * @param {object[]} input.items each: employee_id, name, gross, allowances, deductions,
 *   net, labour_contract_status, employment_status, work_permit_no, personal_no, iban,
 *   bank_name, bank_verified, component_sum (null when there is no breakdown)
 * @param {object} input.company { mol_id }
 * @param {object[]} [input.variance] rows from computeVariance
 */
export function checkRun({ items, company, variance = [] }) {
  const errors = [], warnings = [];
  const add = (list, it, code, detail = null) =>
    list.push({ employee_id: it?.employee_id ?? null, name: it?.name ?? null, code, detail });

  let inWps = 0;
  for (const it of items || []) {
    if (!(Number(it.gross) > 0)) add(errors, it, 'NO_SALARY');

    const leaving = ['Offboarding', 'Exited'].includes(it.employment_status);
    // Same rule as the WPS file: only an issued labour contract is paid through
    // WPS, so only those need the bank and ministry identifiers.
    if (it.labour_contract_status === 'Issued' && !leaving) {
      inWps++;
      const missing = [];
      if (!it.work_permit_no) missing.push('work_permit_no');
      if (!it.personal_no) missing.push('personal_no');
      if (!it.iban) missing.push('iban');
      if (!it.bank_name) missing.push('bank_name');
      if (missing.length) add(errors, it, 'WPS_MISSING', missing);
      if (it.iban && !isValidUaeIban(it.iban)) add(errors, it, 'IBAN_INVALID');
      if (it.iban && !it.bank_verified) add(warnings, it, 'BANK_UNVERIFIED');
    } else if (!leaving) {
      add(warnings, it, 'NOT_IN_WPS');
    }

    if (Number(it.gross) > 0 && Number(it.deductions) > Number(it.gross) / 2) add(warnings, it, 'DEDUCTIONS_OVER_HALF');
    if (it.component_sum != null && round2(it.component_sum) !== round2(it.allowances)) {
      add(warnings, it, 'COMPONENTS_MISMATCH', { components: round2(it.component_sum), allowances: round2(it.allowances) });
    }
  }
  if (inWps > 0 && !company?.mol_id) add(errors, null, 'COMPANY_MOL_MISSING');

  for (const v of variance) {
    if (v.flagged && v.status === 'changed') add(warnings, v, 'BIG_CHANGE', { prev_net: v.prev_net, net: v.net, pct: v.pct });
    if (v.flagged && v.status === 'new') add(warnings, v, 'NEW_IN_RUN');
  }
  return { errors, warnings, ok: errors.length === 0 };
}
