/**
 * Final settlement: everything owed to, and by, someone who is leaving.
 *
 * Pure and unit-tested. It returns lines, each with its own working, so the
 * document handed to the employee explains itself — the same rule as the
 * monthly payslip.
 *
 *   + Final salary      days not covered by an approved monthly run, up to the
 *                       last working day, at full salary / 30 (a whole calendar
 *                       month counts as 30 days, as payroll does)
 *   + Unused leave      annual leave accrued in the leaving year, less leave
 *                       taken, plus any carry-forward HR confirms; paid on BASIC
 *                       salary / 30 (UAE Labour Law: leave pay is on basic wage)
 *   + Gratuity          services/eosbService.js, unchanged
 *   + One-time items    entered for this person but never paid by a monthly run
 *   - Loans             whatever is still outstanding
 *   ± Manual lines      notice pay in lieu, notice not served, damages…
 *
 * The legal deadline for paying it is 14 days after the last working day.
 */
import { calculateEOSB } from './eosbService.js';

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const money = (n) => round2(n).toFixed(2);
export const SETTLEMENT_DUE_DAYS = 14;

const parse = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
};
const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const isoOf = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** 'YYYY-MM-DD' + n days. */
export function addDays(iso, n) {
  const p = parse(iso);
  if (!p) return null;
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
  return dt.toISOString().slice(0, 10);
}

/**
 * Salary days between two dates inclusive, payroll style: each calendar month
 * fully covered is 30 days, a partial month is its actual days (never above 30).
 */
export function salaryDays(fromIso, toIso) {
  const a = parse(fromIso), b = parse(toIso);
  if (!a || !b || fromIso > toIso) return 0;
  let days = 0;
  let y = a.y, m = a.m;
  while (y < b.y || (y === b.y && m <= b.m)) {
    const last = daysInMonth(y, m);
    const start = (y === a.y && m === a.m) ? a.d : 1;
    const end = (y === b.y && m === b.m) ? b.d : last;
    days += (start === 1 && end === last) ? 30 : Math.min(30, end - start + 1);
    m += 1; if (m > 12) { m = 1; y += 1; }
  }
  return days;
}

/**
 * The first day the final salary has to cover: the day after the last month an
 * approved monthly run paid, but never before the employee started.
 * @param {string|null} lastPaidPeriod 'YYYY-MM' of the latest approved/paid run, or null
 */
export function finalSalaryFrom(lastPaidPeriod, startDate) {
  let from = null;
  if (lastPaidPeriod && /^\d{4}-\d{2}$/.test(lastPaidPeriod)) {
    const [y, m] = lastPaidPeriod.split('-').map(Number);
    from = m === 12 ? isoOf(y + 1, 1, 1) : isoOf(y, m + 1, 1);
  }
  const start = startDate ? String(startDate).slice(0, 10) : null;
  if (!from) return start;
  return start && start > from ? start : from;
}

/**
 * Annual leave accrued in the leaving (calendar) year.
 *
 * Under six months of service: none. Six to twelve months: two days for each
 * completed month. A year or more: thirty days a year, pro rata to the part of
 * the leaving year worked.
 */
export function accruedAnnualLeave(startDate, lastWorkingDay) {
  const s = parse(startDate), e = parse(lastWorkingDay);
  if (!s || !e) return 0;
  let months = (e.y - s.y) * 12 + (e.m - s.m);
  if (e.d < s.d) months -= 1;
  if (months < 6) return 0;
  if (months < 12) return months * 2;
  // From 1 January of the leaving year (or the start date, if later) to the LWD.
  const yearStart = isoOf(e.y, 1, 1);
  const from = String(startDate).slice(0, 10) > yearStart ? String(startDate).slice(0, 10) : yearStart;
  const dayIndex = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  const worked = (dayIndex(String(lastWorkingDay).slice(0, 10)) - dayIndex(from)) / 86400000 + 1;
  const yearDays = ((e.y % 4 === 0 && e.y % 100 !== 0) || e.y % 400 === 0) ? 366 : 365;
  return round2(30 * worked / yearDays);
}

/**
 * @param {object} input
 * @param {{basic_salary:number, full_salary:number, start_date:string}} input.employee
 * @param {string} input.lastWorkingDay
 * @param {string} input.departureType
 * @param {string|null} input.lastPaidPeriod
 * @param {number} [input.unpaidLeaveDays]   excluded from gratuity service
 * @param {number} [input.annualTakenThisYear]
 * @param {number} [input.carryForwardDays]
 * @param {number|null} [input.leaveDaysOverride] HR's confirmed unused days, replacing the computed figure
 * @param {{id:number, type:string, outstanding:number}[]} [input.loans]
 * @param {{id:number, kind:string, label:string, amount:number}[]} [input.adjustments]
 * @param {{kind:string, label:string, amount:number}[]} [input.manualLines]
 */
export function buildSettlement(input) {
  const emp = input.employee || {};
  const basic = Math.max(0, Number(emp.basic_salary) || 0);
  const full = Math.max(basic, Number(emp.full_salary) || basic);
  const lwd = String(input.lastWorkingDay || '').slice(0, 10);
  const lines = [];
  const add = (kind, code, label, amount, extra = {}) =>
    lines.push({ kind, code, label, amount: round2(amount), quantity: null, rate: null, explanation: '', source: 'auto', ref_id: null, ...extra });

  // Final salary
  const from = finalSalaryFrom(input.lastPaidPeriod, emp.start_date);
  const days = from && lwd ? salaryDays(from, lwd) : 0;
  const dailyFull = full / 30;
  if (days > 0) {
    add('earning', 'FINAL_SALARY', 'Final salary', days * dailyFull, {
      quantity: days, rate: round2(dailyFull),
      explanation: `${from} to ${lwd}: ${days} day(s) x ${money(dailyFull)} (gross ${money(full)} / 30)`,
    });
  }

  // Unused annual leave
  const accrued = accruedAnnualLeave(emp.start_date, lwd);
  const taken = Math.max(0, Number(input.annualTakenThisYear) || 0);
  const carry = Math.max(0, Number(input.carryForwardDays) || 0);
  // Opening balances, carried days, corrections, lapses and encashments of the
  // leaving year (leave_adjustments), signed.
  const ledger = Number(input.ledgerDays) || 0;
  const computedLeave = round2(Math.max(0, accrued - taken + ledger) + carry);
  const override = input.leaveDaysOverride;
  const leaveDays = override != null && override !== '' && Number.isFinite(Number(override))
    ? round2(Math.max(0, Number(override))) : computedLeave;
  const dailyBasic = basic / 30;
  if (leaveDays > 0) {
    add('earning', 'LEAVE_ENCASHMENT', 'Unused annual leave', leaveDays * dailyBasic, {
      quantity: leaveDays, rate: round2(dailyBasic),
      explanation: (override != null && override !== ''
        ? `${leaveDays} day(s) confirmed by HR`
        : `accrued ${accrued} - taken ${taken}${ledger ? ` ${ledger > 0 ? '+' : '-'} balance adjustments ${Math.abs(ledger)}` : ''}${carry ? ` + carried forward ${carry}` : ''} = ${leaveDays} day(s)`)
        + ` x ${money(dailyBasic)} (basic ${money(basic)} / 30)`,
    });
  }

  // Gratuity
  const eosb = calculateEOSB({
    startDate: emp.start_date, lastWorkingDay: lwd, basicSalary: basic,
    departureType: input.departureType, unpaidLeaveDays: Number(input.unpaidLeaveDays) || 0,
  });
  if (eosb.eosb_amount > 0) {
    add('earning', 'GRATUITY', 'End-of-service gratuity', eosb.eosb_amount, {
      quantity: eosb.gratuity_days, rate: eosb.daily_wage,
      explanation: `${eosb.service_years} year(s) of service, ${eosb.gratuity_days} day(s) x ${money(eosb.daily_wage)} (basic / 30)`
        + (eosb.cap_applied ? ', capped at two years of wage' : ''),
    });
  }

  // One-time items never paid by a monthly run
  for (const a of input.adjustments || []) {
    if (!(Number(a.amount) > 0)) continue;
    add(a.kind === 'deduction' ? 'deduction' : 'earning', 'ONE_TIME', a.label, a.amount, { ref_id: a.id });
  }

  // Approved overtime no monthly run paid
  for (const o of input.overtime || []) {
    if (!(Number(o.amount) > 0)) continue;
    add('earning', 'OVERTIME', 'Approved overtime', o.amount, { ref_id: o.id, explanation: o.explanation || '' });
  }

  // Outstanding loans
  for (const l of input.loans || []) {
    if (!(Number(l.outstanding) > 0)) continue;
    add('deduction', 'LOAN', l.type === 'Advance' ? 'Outstanding salary advance' : 'Outstanding loan', l.outstanding, {
      ref_id: l.id, explanation: 'Balance not yet repaid through payroll',
    });
  }

  // Manual lines
  for (const m of input.manualLines || []) {
    if (!(Number(m.amount) > 0)) continue;
    lines.push({ kind: m.kind === 'deduction' ? 'deduction' : 'earning', code: 'MANUAL', label: m.label,
      amount: round2(m.amount), quantity: null, rate: null, explanation: m.explanation || '', source: 'manual',
      ref_id: m.id ?? null });
  }

  const earnings = round2(lines.filter((l) => l.kind === 'earning').reduce((s, l) => s + l.amount, 0));
  const deductions = round2(lines.filter((l) => l.kind === 'deduction').reduce((s, l) => s + l.amount, 0));
  const pick = (code) => round2(lines.filter((l) => l.code === code).reduce((s, l) => s + l.amount, 0));
  return {
    lines: lines.map((l, i) => ({ ...l, sort: i })),
    totals: {
      final_salary: pick('FINAL_SALARY'),
      leave_encashment: pick('LEAVE_ENCASHMENT'),
      gratuity: pick('GRATUITY'),
      earnings, deductions,
      // Never negative: what someone owes beyond their dues is recovered
      // separately, not by paying them a negative amount.
      net: round2(Math.max(0, earnings - deductions)),
      shortfall: round2(Math.max(0, deductions - earnings)),
    },
    facts: {
      final_salary_from: from, final_salary_days: days, accrued_leave: accrued, leave_taken: taken,
      carry_forward: carry, leave_days: leaveDays, computed_leave_days: computedLeave,
      gratuity: { eligible: eosb.eligible, reason: eosb.reason, service_years: eosb.service_years, cap_applied: eosb.cap_applied },
      due_date: lwd ? addDays(lwd, SETTLEMENT_DUE_DAYS) : null,
    },
  };
}
