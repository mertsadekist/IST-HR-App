// Idempotent migration: add employees.is_owner — marks the person as an owner of
// the company, who is exempt from attendance tracking.
//
// An owner keeps their own hours, so a late arrival or an early exit is not an
// exception anyone has to explain. The flag is read by the Hik sync, the schedule
// evaluator, the attendance pages and reports, and payroll's absence/leave
// deductions — see server/services/ownerExemption.js.
//
// Default FALSE: nobody is exempt until an admin says so. Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

try {
  if (!(await columnExists('employees', 'is_owner'))) {
    await pool.query('ALTER TABLE employees ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT FALSE');
    console.log('employees.is_owner added');
  } else {
    console.log('employees.is_owner already present');
  }
  console.log('EMPLOYEE_OWNER MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
