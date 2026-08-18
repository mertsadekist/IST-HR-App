/**
 * Why each payslip says what it says.
 *
 * A payroll line reading "deductions 2300.00" is not something you can hand an
 * employee. This builds the document you can: for every person, which days cost
 * them money, why that day counted, what rate it was paid at, and the arithmetic
 * that turns those facts into the figure on their payslip.
 *
 * Two rules shape the whole thing.
 *
 * **It recomputes rather than reports.** The stored `payroll_items.deductions` is
 * a single number with no trail behind it, so the breakdown is derived again from
 * the leave and attendance records and then checked against what was stored. When
 * the two disagree the document says so on its face rather than presenting a tidy
 * explanation for a figure it does not actually explain — a mismatch means the run
 * predates a policy change or somebody edited a record after it was generated, and
 * either way the employee should not be shown fiction.
 *
 * **Every line shows its own arithmetic.** Not "100.00" but
 * "3000.00 / 30 = 100.00 x 1 day x 100% unpaid = 100.00". Somebody who cannot
 * follow the sum cannot check it, and a deduction nobody can check is one HR ends
 * up defending from memory.
 */
import { loadLeavePolicy, leaveDeductionForPeriod, annualEntitlement } from './leavePolicyService.js';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const dayName = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  return m ? DAY_NAMES[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()] : '';
};

/** A pay factor of 0.5 means half the day was withheld. */
const withheldPct = (factor) => `${Math.round((1 - factor) * 100)}%`;

/**
 * Everything needed to explain one payroll run, per employee.
 *
 * @param {object} db pool or connection
 * @param {number} runId
 */
export async function buildPayrollExplanation(db, runId) {
  const [[run]] = await db.query(
    `SELECT pr.id, pr.company_id, pr.period, pr.status, pr.created_at,
            c.name AS company_name, c.short_code, c.currency
       FROM payroll_runs pr LEFT JOIN companies c ON c.id = pr.company_id
      WHERE pr.id = ?`, [runId]);
  if (!run) return null;

  const periodStart = `${run.period}-01`;
  const [[{ last_day: periodEnd }]] = await db.query(
    "SELECT DATE_FORMAT(LAST_DAY(?), '%Y-%m-%d') last_day", [periodStart]);
  const year = Number(run.period.slice(0, 4));

  const [items] = await db.query(
    `SELECT pi.employee_id, pi.basic_salary, pi.allowances, pi.gross,
            pi.unpaid_leave_days, pi.absence_days, pi.deductions, pi.net,
            CONCAT(e.first_name, ' ', e.last_name) AS name, e.attendance_id,
            DATE_FORMAT(e.start_date, '%Y-%m-%d') AS start_date,
            d.name AS department, COALESCE(jt.title, e.job_title_text) AS job_title
       FROM payroll_items pi
       JOIN employees e ON e.id = pi.employee_id
       LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN job_titles jt ON jt.id = e.job_title_id
      WHERE pi.run_id = ?
      ORDER BY e.first_name, e.last_name`, [runId]);

  const policy = await loadLeavePolicy(db);
  const typeNames = new Map(policy.types.map((t) => [t.id, t.name]));

  const employees = [];
  for (const it of items) {
    const gross = round2(it.gross);
    const dailyRate = round2(gross / 30);

    // ── leave, recomputed day by day so each day carries its own rate ──
    const [yearLeave] = await db.query(
      `SELECT lr.id, lr.leave_type_id, lr.days, lr.reason,
              DATE_FORMAT(lr.start_date, '%Y-%m-%d') start_date,
              DATE_FORMAT(lr.end_date,   '%Y-%m-%d') end_date
         FROM leave_requests lr
        WHERE lr.employee_id = ? AND lr.status = 'Approved'
          AND lr.end_date >= ? AND lr.start_date <= ?
        ORDER BY lr.start_date`, [it.employee_id, `${year}-01-01`, `${year}-12-31`]);

    const capByType = new Map(policy.capByType);
    let annualCap = null;
    if (policy.annualTypeId) {
      annualCap = it.start_date
        ? annualEntitlement(it.start_date, periodEnd)
        : policy.defaultDaysByType.get(policy.annualTypeId) ?? null;
      capByType.set(policy.annualTypeId, annualCap);
    }

    const leave = leaveDeductionForPeriod({
      requests: yearLeave,
      tiersByType: policy.tiersByType,
      poolByType: policy.poolByType,
      capByType,
      periodStart,
      periodEnd,
      typeNames,
    });

    const noteByRequest = new Map(yearLeave.map((r) => [r.id, r.reason]));
    const leaveLines = (leave.lines || [])
      .filter((l) => l.deduction_days > 0)
      .map((l) => {
        const amount = round2(l.deduction_days * dailyRate);
        return {
          date: l.date,
          day: dayName(l.date),
          category: 'Leave',
          reason: l.leave_type_name || 'Leave',
          note: noteByRequest.get(l.request_id) || '',
          share: l.day_share,
          pay_factor: l.pay_factor,
          deduction_days: l.deduction_days,
          amount,
          calculation: `${gross.toFixed(2)} / 30 = ${dailyRate.toFixed(2)}`
            + ` x ${l.day_share} day x ${withheldPct(l.pay_factor)} withheld = ${amount.toFixed(2)}`,
        };
      });

    // ── absence, excluding any day already accounted for as leave ──
    //
    // The same exclusion payroll itself applies. Without it a day that is both an
    // Absent row and inside approved leave would appear twice in the explanation
    // and the total would not reconcile.
    const [absences] = await db.query(
      `SELECT DATE_FORMAT(a.work_date, '%Y-%m-%d') work_date,
              TIME_FORMAT(a.check_in, '%H:%i') check_in,
              a.eval_status, ws.name_en AS schedule_name,
              x.detail AS exception_detail
         FROM attendance a
         LEFT JOIN work_schedules ws ON ws.id = a.schedule_id
         LEFT JOIN attendance_exceptions x
                ON x.employee_id = a.employee_id AND x.work_date = a.work_date
               AND x.type = 'ABSENT_NO_RECORD'
        WHERE a.employee_id = ? AND a.status = 'Absent'
          AND a.work_date BETWEEN ? AND ?
          AND NOT EXISTS (
            SELECT 1 FROM leave_requests lr
             WHERE lr.employee_id = a.employee_id AND lr.status = 'Approved'
               AND a.work_date BETWEEN lr.start_date AND lr.end_date)
        ORDER BY a.work_date`, [it.employee_id, periodStart, periodEnd]);

    const absenceLines = absences.map((a) => {
      // Payroll deducts on the STORED status. The schedule engine has its own
      // verdict on the same day, and where it says the day was never a working
      // one, this deduction is money withheld for somebody's weekend. The engine
      // is still in shadow mode so it cannot stop the charge — but the person
      // signing the payslip should not have to go and look it up.
      const engineSaysNotWorking = ['Weekend', 'Holiday', 'On Leave'].includes(a.eval_status);
      return {
        date: a.work_date,
        day: dayName(a.work_date),
        category: 'Absence',
        reason: 'Unauthorised absence',
        note: engineSaysNotWorking
          ? `⚠ CHECK THIS — the schedule engine reads ${a.work_date} as "${a.eval_status}" for this employee`
            + `${a.schedule_name ? ` on ${a.schedule_name}` : ''}, not a working day. `
            + 'The attendance record still says Absent, which is what payroll charged.'
          : (a.exception_detail || 'No punches recorded and no approved leave covering the day.'),
        disputed: engineSaysNotWorking,
        engine_status: a.eval_status || null,
        schedule_name: a.schedule_name || null,
        share: 1,
        pay_factor: 0,
        deduction_days: 1,
        amount: dailyRate,
        calculation: `${gross.toFixed(2)} / 30 = ${dailyRate.toFixed(2)}`
          + ` x 1 day x 100% withheld = ${dailyRate.toFixed(2)}`,
      };
    });

    const lines = [...leaveLines, ...absenceLines].sort((a, b) => a.date.localeCompare(b.date));
    const recomputed = round2(lines.reduce((s, l) => s + l.amount, 0));
    const stored = round2(it.deductions);
    const leaveDeduction = round2(leaveLines.reduce((s, l) => s + l.amount, 0));
    const absenceDeduction = round2(absenceLines.reduce((s, l) => s + l.amount, 0));

    const parts = [];
    if (leaveLines.length) {
      parts.push(`${round2(leaveLines.reduce((s, l) => s + l.deduction_days, 0))} day(s) of unpaid or part-paid leave`);
    }
    if (absenceLines.length) parts.push(`${absenceLines.length} day(s) of unauthorised absence`);

    employees.push({
      employee_id: it.employee_id,
      name: it.name,
      attendance_id: it.attendance_id,
      department: it.department,
      job_title: it.job_title,
      start_date: it.start_date,
      basic: round2(it.basic_salary),
      allowances: round2(it.allowances),
      gross,
      daily_rate: dailyRate,
      annual_entitlement: annualCap,
      lines,
      // Dates a second approved request tried to claim after the first had
      // already taken the day. Reported rather than silently dropped: the money
      // is now right, but the duplicate approvals are still in the system.
      overlaps: leave.overlaps || [],
      disputed_days: lines.filter((l) => l.disputed).length,
      leave_deduction: leaveDeduction,
      absence_deduction: absenceDeduction,
      recomputed_deduction: recomputed,
      stored_deduction: stored,
      // A gap over a fil means the stored figure is not what these lines add up
      // to, and the reader is told rather than reassured.
      matches: Math.abs(recomputed - stored) < 0.02,
      net: round2(it.net),
      summary: lines.length === 0
        ? 'Full pay. No unpaid leave and no unexplained absence this period.'
        : `${lines.length} day(s) affected: ${parts.join(', ')}.`,
    });
  }

  // The policy as it stands, so a reader can check the rule and not only the sum.
  const [tiers] = await db.query(
    `SELECT lt.name, lt.description, lt.accrual, lt.default_days,
            t.from_day, t.to_day, t.pay_factor, t.label
       FROM leave_types lt
       LEFT JOIN leave_type_tiers t ON t.leave_type_id = lt.id
      WHERE lt.status = 'Active'
      ORDER BY lt.sort_order, lt.name, t.from_day`);

  return { run, periodStart, periodEnd, employees, tiers };
}
