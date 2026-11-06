/**
 * Company owners are exempt from attendance.
 *
 * An owner keeps their own hours — arriving late or leaving early is not an
 * exception, and nobody on the HR team should be asked to write a reason for it.
 * `employees.is_owner` is the one flag; everything that would otherwise judge,
 * list, or charge an employee's attendance consults it:
 *
 *   - the Hik sync neither records their punches nor closes their days as absent
 *   - the schedule evaluator never produces cases for them
 *   - the attendance pages, exports and evaluation reports leave them out
 *   - payroll withholds nothing for absence or leave (their salary line stays)
 *
 * These fragments are for queries that already alias the employees table.
 */
import { OPEN_STATUSES } from '../config/attendanceExceptions.js';

/** `AND` fragment for a query that joins employees as `alias`. */
export const notOwnerSql = (alias = 'e') => ` AND ${alias}.is_owner = FALSE`;

/**
 * `AND` fragment for a query that carries an employee id column but does not join
 * employees (attendance_exceptions, attendance).
 */
export const notOwnerByIdSql = (col = 'x.employee_id') =>
  ` AND NOT EXISTS (SELECT 1 FROM employees own WHERE own.id = ${col} AND own.is_owner = TRUE)`;

/** True when the employee is an owner. Unknown ids are not owners. */
export async function isOwnerEmployee(db, employeeId) {
  const [[row]] = await db.query('SELECT is_owner FROM employees WHERE id = ?', [employeeId]);
  return !!row?.is_owner;
}

/**
 * Stand down every case still open against someone who has just been marked as
 * an owner. Closed, not deleted, so the trail survives if the flag is reversed.
 * Cases a person already decided (Resolved, Waived) are left alone.
 */
export async function waiveOpenCasesFor(db, employeeId) {
  const [r] = await db.query(
    `UPDATE attendance_exceptions
        SET status = 'Waived', resolution = 'Company owner — exempt from attendance', resolved_at = NOW()
      WHERE employee_id = ? AND status IN (${OPEN_STATUSES.map(() => '?').join(',')})`,
    [employeeId, ...OPEN_STATUSES]);
  return r.affectedRows;
}
