// Idempotent data fix: align each user account's company with the employee
// record it is linked to.
//
// Six accounts sat in IST Markets while their employee record sat in IST Real
// Estate. The employee record is the authority — it is what payroll, WPS, leave
// entitlement and the org chart are built from — so the user account follows it,
// never the other way round.
//
// The symptom that surfaced this: an employee could see their June and July
// attendance but not August, because the August rows had been recorded under
// the employee record's company while their user account pinned reads to the
// other one. The read paths no longer apply that filter (see ownRecordsClause
// in middleware/tenant.js), so this is no longer load-bearing for self-service
// — but a user account filed under the wrong company is still wrong, and it
// still decides which company's data an internal role would browse by default.
//
// Guards:
//  - Accounts with company_id IS NULL are untouched. That is how a platform
//    admin is expressed, and giving one a company would demote them.
//  - Accounts with no linked employee record are untouched — there is nothing
//    to match them against.
//  - Every change is written to the audit trail with the previous value, so the
//    edit is traceable and reversible.
//
// Safe to re-run: a second pass finds nothing to do.
import pool from './config/db.js';
import { addAudit } from './services/auditService.js';

const SYSTEM = { id: null, name: 'System (migration)', company_id: null };

try {
  const [rows] = await pool.query(`
    SELECT u.id AS user_id, u.username, u.name, u.role,
           u.company_id AS from_company, cu.name AS from_name,
           e.id AS employee_id, e.company_id AS to_company, ce.name AS to_name
      FROM users u
      JOIN employees e ON u.employee_id = e.id
      LEFT JOIN companies cu ON u.company_id = cu.id
      LEFT JOIN companies ce ON e.company_id = ce.id
     WHERE u.company_id IS NOT NULL
       AND e.company_id IS NOT NULL
       AND u.company_id <> e.company_id
     ORDER BY u.id`);

  if (!rows.length) {
    console.log('No mismatched accounts — nothing to do.');
  } else {
    console.log(`${rows.length} account(s) to align:\n`);
    for (const r of rows) {
      console.log(`  #${r.user_id} ${r.username.padEnd(18)} ${String(r.role).padEnd(10)} `
        + `${r.from_name} (${r.from_company})  ->  ${r.to_name} (${r.to_company})`);
    }
    console.log('');

    for (const r of rows) {
      // Re-read inside the loop so a concurrent edit is not overwritten blindly.
      const [result] = await pool.query(
        'UPDATE users SET company_id = ? WHERE id = ? AND company_id = ?',
        [r.to_company, r.user_id, r.from_company]);
      if (!result.affectedRows) {
        console.log(`  skipped #${r.user_id} — changed by someone else since the scan`);
        continue;
      }
      await addAudit(pool, SYSTEM, 'Users', 'Company Corrected',
        `User "${r.username}" (#${r.user_id}) moved from ${r.from_name} (#${r.from_company}) `
        + `to ${r.to_name} (#${r.to_company}) to match employee record #${r.employee_id}`,
        r.to_company);
      console.log(`  updated #${r.user_id} ${r.username}`);
    }
  }

  const [[left]] = await pool.query(`
    SELECT COUNT(*) n FROM users u JOIN employees e ON u.employee_id = e.id
     WHERE u.company_id IS NOT NULL AND e.company_id IS NOT NULL AND u.company_id <> e.company_id`);
  console.log(`\nremaining mismatches: ${left.n}`);

  // Reported, not changed: the rows themselves can still be filed under either
  // company, which is a separate question from where the account sits.
  const [split] = await pool.query(`
    SELECT e.id, CONCAT(e.first_name, ' ', e.last_name) AS name, e.company_id AS emp_company,
           a.company_id AS row_company, COUNT(*) AS rows_affected
      FROM attendance a JOIN employees e ON a.employee_id = e.id
     WHERE a.company_id <> e.company_id
     GROUP BY e.id, name, e.company_id, a.company_id
     ORDER BY rows_affected DESC`);
  if (split.length) {
    console.log('\nFYI — attendance rows filed under a different company than the employee:');
    for (const s of split) {
      console.log(`  ${s.name} (#${s.id}): ${s.rows_affected} row(s) under company ${s.row_company}, employee is in ${s.emp_company}`);
    }
    console.log('  Left alone: this migration only aligns accounts. Say so if these should move too.');
  }

  console.log('\nUSER_COMPANY_MISMATCH FIX OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
