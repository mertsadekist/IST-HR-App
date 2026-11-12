// Shared by Payroll Runs, My Salary and the salary breakdown editor, so a
// payslip line reads the same everywhere. Codes mirror server/services/payrollV2.js.

export function lineLabel(t, line, lang) {
  switch (line.code) {
    case 'BASIC': return t('payslip.line_basic');
    case 'ALLOWANCE': return t('payslip.line_allowances');
    case 'ALLOWANCE_OTHER': return Number(line.amount) < 0 ? t('payslip.line_adjustment') : t('payslip.line_other_allowances');
    case 'HOUSING': return t('payslip.comp_housing');
    case 'TRANSPORT': return t('payslip.comp_transport');
    case 'FOOD': return t('payslip.comp_food');
    case 'PHONE': return t('payslip.comp_phone');
    case 'OTHER': return t('payslip.comp_other');
    case 'ABSENCE': return t('payslip.line_absence');
    case 'EXTRA': return t('payslip.line_extra');
    // Totals, used by the month-on-month comparison of runs made before v2.
    case 'GROSS': return t('payslip.gross');
    case 'DEDUCTIONS': return t('payslip.deductions');
    // A leave line is labelled with its leave type's own name.
    case 'LEAVE': return line.label === 'Leave deduction' ? t('payslip.line_leave') : line.label;
    default: return (lang === 'ar' && line.label_ar) || line.label || line.code;
  }
}

/** "2 days × 333.33" for a line that has a quantity and a rate, else ''. */
export function lineWorking(t, line) {
  if (line.quantity == null || line.rate == null) return '';
  return t('payslip.working', { qty: Number(line.quantity), rate: Number(line.rate).toFixed(2) });
}

export const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** The component codes the breakdown editor offers, translated. */
export function componentLabel(t, code) {
  return lineLabel(t, { code });
}
