// Idempotent migration: give departed staff the end date HR already recorded.
//
// `offboarding_records.last_working_day` was filled in for all six people
// currently mid-offboarding, but `employees.end_date` was left NULL. Nothing
// copied one to the other, so from the employee record's point of view they are
// still employed with no end in sight.
//
// That was cosmetic until the attendance evaluator arrived. The evaluator skips
// dates outside an employee's employment window, and with no end date there is
// no window to fall outside of — so somebody who left in July collects a fresh
// absence every working day, forever. Three of the six accounted for 23 of the
// 41 absences in the first shadow run over August.
//
// `last_working_day` is HR's own entered value and is taken as authoritative.
// It was checked against the punch record before this was written: five of the
// six have no real punch after their last working day at all, and the sixth has
// exactly one, the day after. Nobody's history contradicts it.
//
// Note for anyone reading these dates back: `last_working_day` is a DATE, and
// the driver turns a DATE into a JS Date shifted into UTC — reading it without
// DATE_FORMAT reports the previous day. The first draft of this migration had
// three of the six dates off by one for exactly that reason.
//
// employees.end_date is not read by payrollService or eosbService (the EOSB
// calculation uses offboarding_records.employment_start and last_working_day
// directly), so this changes no figure anyone is paid.
//
// Safe to re-run: only fills a NULL, never overwrites a date already set.
import pool from './config/db.js';

try {
  const [candidates] = await pool.query(`
    SELECT e.id, CONCAT(e.first_name, ' ', e.last_name) name, e.status,
           DATE_FORMAT(o.last_working_day, '%Y-%m-%d') last_working_day,
           (SELECT COUNT(*) FROM attendance a
             WHERE a.employee_id = e.id AND a.check_in IS NOT NULL
               AND a.work_date > o.last_working_day) punches_after
      FROM employees e
      JOIN offboarding_records o ON o.employee_id = e.id
     WHERE e.end_date IS NULL AND o.last_working_day IS NOT NULL
     ORDER BY o.last_working_day`);

  if (!candidates.length) {
    console.log('every departed employee already has an end date');
  }

  let filled = 0;
  for (const c of candidates) {
    await pool.query('UPDATE employees SET end_date = ? WHERE id = ? AND end_date IS NULL',
      [c.last_working_day, c.id]);
    filled++;
    console.log(`  ${c.name.padEnd(24)} end_date = ${c.last_working_day}`
      + (c.punches_after ? `   (note: ${c.punches_after} punch(es) recorded after that date)` : ''));
  }

  const [[left]] = await pool.query(`
    SELECT COUNT(*) c FROM employees
     WHERE status IN ('Offboarding', 'Exited') AND end_date IS NULL`);
  console.log(`\n${filled} end date(s) filled`);
  if (left.c) {
    console.log(`${left.c} departed employee(s) still have no end date and no offboarding record `
      + '— the evaluator will keep marking them absent until one is entered');
  } else {
    console.log('no departed employee is left without an end date');
  }
  console.log('BACKFILL_EMPLOYEE_END_DATE OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
