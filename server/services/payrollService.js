/**
 * Payroll calculation — pure, deterministic, unit-tested.
 *
 * Computes one employee's payslip line from their salary plus period deductions.
 *  - basic        : monthly basic salary
 *  - full         : monthly full/gross salary (basic + allowances). Falls back to basic.
 *  - allowances   : full - basic (never negative)
 *  - daily rate   : basic / 30 (consistent with the EOSB engine)
 *  - deductions   : (unpaid leave days + unauthorized absence days) × daily rate, + extraDeductions
 *  - net          : gross - deductions (floored at 0)
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
}) {
  const basic = Math.max(0, Number(basicSalary) || 0);
  const full = Math.max(basic, Number(fullSalary) || basic); // full is never below basic
  const allowances = round2(full - basic);
  const dailyRate = basic / 30;

  const unpaid = Math.max(0, Number(unpaidLeaveDays) || 0);
  const absence = Math.max(0, Number(absenceDays) || 0);
  const extra = Math.max(0, Number(extraDeductions) || 0);

  const leaveAbsenceDeduction = round2((unpaid + absence) * dailyRate);
  const deductions = round2(leaveAbsenceDeduction + extra);
  const gross = round2(full);
  const net = round2(Math.max(0, gross - deductions));

  return {
    basic_salary: round2(basic),
    allowances,
    gross,
    daily_rate: round2(dailyRate),
    unpaid_leave_days: round2(unpaid),
    absence_days: round2(absence),
    leave_absence_deduction: leaveAbsenceDeduction,
    extra_deductions: round2(extra),
    deductions,
    net,
  };
}
