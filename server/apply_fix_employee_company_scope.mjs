// Idempotent migration: file every employee-scoped row under the employee's own
// company, and move six people onto departments that belong to their company.
//
// The problem, as found on 13 Aug 2026:
//
//   242 attendance rows for seven IST Real Estate staff were stamped IST Markets.
//   All of them are `source = 'Manual'`, dated 1 Jun – 25 Jul, and the same people
//   have their August rows filed correctly. The manual CSV imports of that period
//   were run with IST Markets selected as the entity, so resolveWriteCompanyId
//   stamped company 2 on every row regardless of whose it was.
//
// A sweep of every table carrying both company_id and employee_id found the same
// fingerprint elsewhere — bank details, leave balances and requests, one
// onboarding record — 259 rows in total.
//
// Why it matters more than tidiness: company scoping is what decides whether a
// person can see their own data (see ownRecordsClause in middleware/tenant.js,
// which exists because of exactly this), and from now on the company also selects
// the WORK SCHEDULE. IST Real Estate works Saturday 10:00–15:00 and IST Markets
// does not, so a row under the wrong company would be judged against a Saturday
// the person never works.
//
// The employee record is authoritative. That was confirmed with the business:
// the six whose department sat in IST Markets are IST Real Estate staff, and it
// is the department that is wrong. Their user accounts were already aligned to
// company 1 and are left alone.
//
// Safe to re-run — a second run finds nothing to do.
import pool from './config/db.js';

// Explicit, not discovered at runtime. A migration that swept every table with
// the two columns would also sweep a future table where a difference is
// legitimate.
const SCOPED_TABLES = [
  'attendance',              // 242 — the mis-stamped manual imports
  'employee_bank_details',   //   3
  'employee_bank_files',     //   1
  'leave_balances',          //   5
  'leave_requests',          //   7
  'onboarding_records',      //   1
];

// Six people whose department belongs to the other company. Guarded on the
// current department id, so a second run — or a later correction by HR — is not
// undone. job_title_id is NULL for all of them (their titles are free text in
// job_title_text), so moving the department orphans nothing.
const DEPARTMENT_MOVES = [
  { employee: 115, from: 11, to: 6, why: 'Risk & Dealing (Markets) → Head of Management — Operations Lead' },
  { employee: 118, from: 14, to: 5, why: 'Marketing Management (Markets) → Marketing — Performance Marketer' },
  { employee: 119, from: 14, to: 5, why: 'Marketing Management (Markets) → Marketing — Performance Marketer' },
  { employee: 120, from: 14, to: 5, why: 'Marketing Management (Markets) → Marketing — Performance Marketer' },
  { employee: 121, from: 14, to: 5, why: 'Marketing Management (Markets) → Marketing — Performance Marketer' },
  { employee: 125, from: 13, to: 7, why: 'Payments & Finance (Markets) → Finance — Accounts' },
];

try {
  let moved = 0;
  for (const table of SCOPED_TABLES) {
    const [[before]] = await pool.query(
      `SELECT COUNT(*) c FROM \`${table}\` x JOIN employees e ON e.id = x.employee_id
        WHERE x.company_id IS NOT NULL AND x.company_id <> e.company_id`);
    if (!before.c) { console.log(`${table}: already consistent`); continue; }

    const [result] = await pool.query(
      `UPDATE \`${table}\` x JOIN employees e ON e.id = x.employee_id
          SET x.company_id = e.company_id
        WHERE x.company_id IS NOT NULL AND x.company_id <> e.company_id`);
    moved += result.affectedRows;
    console.log(`${table}: ${result.affectedRows} row(s) refiled under the employee's company`);
  }

  for (const m of DEPARTMENT_MOVES) {
    const [r] = await pool.query(
      'UPDATE employees SET department_id = ? WHERE id = ? AND department_id = ?',
      [m.to, m.employee, m.from]);
    console.log(r.affectedRows
      ? `employee #${m.employee}: ${m.why}`
      : `employee #${m.employee}: department already moved — left alone`);
  }

  // Prove it, rather than trusting the update counts.
  const problems = [];
  for (const table of SCOPED_TABLES) {
    const [[left]] = await pool.query(
      `SELECT COUNT(*) c FROM \`${table}\` x JOIN employees e ON e.id = x.employee_id
        WHERE x.company_id IS NOT NULL AND x.company_id <> e.company_id`);
    if (left.c) problems.push(`${table} still has ${left.c}`);
  }
  const [[deptLeft]] = await pool.query(
    `SELECT COUNT(*) c FROM employees e JOIN departments d ON d.id = e.department_id
      WHERE e.status IN ('Active','Onboarding') AND d.company_id <> e.company_id`);
  if (deptLeft.c) problems.push(`${deptLeft.c} active employee(s) still sit in another company's department`);
  const [[userLeft]] = await pool.query(
    `SELECT COUNT(*) c FROM users u JOIN employees e ON e.id = u.employee_id
      WHERE u.company_id IS NOT NULL AND u.company_id <> e.company_id`);
  if (userLeft.c) problems.push(`${userLeft.c} user account(s) point at another company`);

  console.log(`\n${moved} scoped row(s) refiled in total`);
  if (problems.length) {
    console.error('STILL INCONSISTENT: ' + problems.join('; '));
    process.exitCode = 1;
  } else {
    console.log('every employee-scoped row, department and user account now agrees with the employee record');
    console.log('FIX_EMPLOYEE_COMPANY_SCOPE MIGRATION OK');
  }
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
