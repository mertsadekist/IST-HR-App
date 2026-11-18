/**
 * GPSSA pension for UAE nationals in the private sector.
 *
 * Two schemes run side by side:
 *  - 'new': Federal Decree-Law 57/2023, for people first insured from
 *    31 Oct 2023. Employee 11%, employer 15%, of which the government pays 2.5
 *    points while the contribution salary is under AED 20,000. Contribution
 *    salary between AED 3,000 and 70,000.
 *  - 'old': Federal Law 7/1999, for people insured before that date. Employee
 *    5%, employer 12.5% (the government's 2.5% is paid on top and does not
 *    touch payroll). Contribution salary between AED 1,000 and 50,000.
 *
 * The figures are law values (one per key and year, editable in Compliance),
 * so a change in the law is a settings change, not a release. The defaults
 * below are used only when no row exists.
 *
 * Not modelled: GCC nationals working in the UAE (they contribute to their home
 * scheme at its own rates) and the Abu Dhabi Pension Fund. HR marks those
 * people 'none' and handles them by hand.
 */
import { lawValueFor } from './complianceService.js';
import { isUaeNational } from './employeeDocumentExpiryService.js';

export const PENSION_SCHEMES = ['auto', 'none', 'old', 'new'];
/** The day Decree-Law 57/2023 took effect for newly insured people. */
export const NEW_SCHEME_FROM = '2023-10-31';

export const PENSION_LAW_KEYS = [
  'gpssa_new_employee_percent', 'gpssa_new_employer_percent', 'gpssa_new_government_percent',
  'gpssa_new_government_below', 'gpssa_new_min_salary', 'gpssa_new_max_salary',
  'gpssa_old_employee_percent', 'gpssa_old_employer_percent', 'gpssa_old_min_salary', 'gpssa_old_max_salary',
];

const DEFAULTS = {
  new: { employee: 11, employer: 15, government: 2.5, government_below: 20000, min: 3000, max: 70000 },
  old: { employee: 5, employer: 12.5, government: 0, government_below: 0, min: 1000, max: 50000 },
};

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Which scheme applies: the employee's own setting, or for 'auto', UAE
 * nationals by when they started (a stand-in for when they were first insured).
 * @returns {'old'|'new'|null}
 */
export function pensionSchemeFor(emp) {
  const s = PENSION_SCHEMES.includes(emp?.pension_scheme) ? emp.pension_scheme : 'auto';
  if (s === 'none') return null;
  if (s === 'old' || s === 'new') return s;
  if (!isUaeNational(emp?.nationality)) return null;
  return emp?.start_date && String(emp.start_date).slice(0, 10) < NEW_SCHEME_FROM ? 'old' : 'new';
}

/** The rates of a scheme for a year, from the law values with the defaults behind them. */
export function pensionRates(lawRows, scheme, year) {
  const d = DEFAULTS[scheme];
  const v = (k, fallback) => lawValueFor(lawRows || [], `gpssa_${scheme}_${k}`, year) ?? fallback;
  return {
    employee: v('employee_percent', d.employee),
    employer: v('employer_percent', d.employer),
    government: scheme === 'new' ? v('government_percent', d.government) : 0,
    government_below: scheme === 'new' ? v('government_below', d.government_below) : 0,
    min: v('min_salary', d.min),
    max: v('max_salary', d.max),
  };
}

/**
 * One month's contributions on a contribution salary.
 * The employee share is deducted from pay; the employer share is a cost to the
 * company (net of the government's part where it applies).
 */
export function pensionContribution({ salary, scheme, rates }) {
  if (!scheme || !(Number(salary) > 0)) return null;
  const base = round2(Math.min(Math.max(Number(salary), rates.min), rates.max));
  const government = base < rates.government_below ? round2(base * rates.government / 100) : 0;
  return {
    scheme, base,
    employee: round2(base * rates.employee / 100),
    employer: round2(base * rates.employer / 100 - government),
    government,
    employee_percent: rates.employee,
  };
}
