/**
 * Payroll calculation — pure, deterministic, unit-tested.
 *
 * Computes one employee's payslip line from their salary plus period deductions.
 *  - basic        : monthly basic salary
 *  - full         : monthly full/gross salary (basic + allowances). Falls back to basic.
 *  - allowances   : full - basic (never negative)
 *  - daily rate   : full (gross) / 30 — unpaid/absence days deduct against gross pay,
 *                   not just the basic component. (The EOSB engine still uses basic/30,
 *                   since UAE gratuity is legally computed on basic salary.)
 *  - additions    : one-time earnings this period (bonus, commission…). Paid on top
 *                   of gross and never part of the daily rate: a bonus does not make
 *                   an absence day cost more. This is the WPS "variable portion".
 *  - deductions   : (unpaid leave days + unauthorized absence days) × daily rate, + extraDeductions
 *                   (one-time deductions and loan instalments)
 *  - net          : gross + additions - deductions (floored at 0)
 *
 * All monetary values rounded to 2 decimals.
 */
function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export function computePayrollItem({
  basicSalary,
  fullSalary,
  unpaidLeaveDays = 0,
  absenceDays = 0,
  extraDeductions = 0,
  extraEarnings = 0,
}) {
  const basic = Math.max(0, Number(basicSalary) || 0);
  const full = Math.max(basic, Number(fullSalary) || basic); // full is never below basic
  const allowances = round2(full - basic);
  const dailyRate = full / 30;

  const unpaid = Math.max(0, Number(unpaidLeaveDays) || 0);
  const absence = Math.max(0, Number(absenceDays) || 0);
  const extra = Math.max(0, Number(extraDeductions) || 0);
  const additions = round2(Math.max(0, Number(extraEarnings) || 0));

  const leaveAbsenceDeduction = round2((unpaid + absence) * dailyRate);
  const deductions = round2(leaveAbsenceDeduction + extra);
  const gross = round2(full);
  const net = round2(Math.max(0, gross + additions - deductions));

  return {
    basic_salary: round2(basic),
    allowances,
    gross,
    additions,
    daily_rate: round2(dailyRate),
    unpaid_leave_days: round2(unpaid),
    absence_days: round2(absence),
    leave_absence_deduction: leaveAbsenceDeduction,
    extra_deductions: round2(extra),
    deductions,
    net,
  };
}
