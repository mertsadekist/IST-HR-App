// Idempotent migration: add employees.attendance_id (the time-clock device ID
// used to map imported attendance rows to an employee). Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

try {
  if (!(await columnExists('employees', 'attendance_id'))) {
    await pool.query('ALTER TABLE employees ADD COLUMN attendance_id VARCHAR(100) NULL AFTER full_salary');
    console.log('employees.attendance_id added');
  } else {
    console.log('employees.attendance_id already present');
  }
  console.log('ATTENDANCE_ID MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
