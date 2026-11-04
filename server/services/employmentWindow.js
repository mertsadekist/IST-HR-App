/**
 * When somebody's employment ends, as far as attendance is concerned.
 *
 * `employees.end_date` alone is not enough. Starting an offboarding records the
 * last working day on `offboarding_records` and never copies it to the employee,
 * so somebody whose departure is under way has no end date at all — and both the
 * schedule checks and the daily close then treat every working day after they
 * left as an unexplained absence, which payroll deducts on.
 *
 * So the effective end is the earlier of:
 *   - the employee's own end_date, and
 *   - the last working day of an offboarding that has not been cancelled.
 *
 * An offboarding whose last working day falls before the employee's current
 * start date belongs to an earlier spell of employment (a rehire) and is ignored.
 *
 * @param {string} alias  the alias of the employees table in the calling query
 * @returns {string} SQL yielding 'YYYY-MM-DD' or NULL
 */
export function effectiveEndDateSql(alias = 'e') {
  const lwd = `(SELECT MAX(o.last_working_day) FROM offboarding_records o
                 WHERE o.employee_id = ${alias}.id AND o.status <> 'Cancelled'
                   AND (${alias}.start_date IS NULL OR o.last_working_day >= ${alias}.start_date))`;
  return `DATE_FORMAT(LEAST(COALESCE(${alias}.end_date, ${lwd}), COALESCE(${lwd}, ${alias}.end_date)), '%Y-%m-%d')`;
}
