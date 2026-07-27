// Idempotent migration: add employees.photo_path + photo_type — the employee's
// profile picture shown on the employee card.
//
// Stored on the persistent uploads volume (like companies.letterhead_path)
// rather than as a base64 column: the employees list does `SELECT e.*` across
// every employee, so an inline data-URI would bloat that payload badly. Only a
// short filename lives on the row; the bytes stream from GET /employees/:id/photo.
// Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const cols = [
  { name: 'photo_path', ddl: 'ALTER TABLE employees ADD COLUMN photo_path VARCHAR(512) NULL' },
  { name: 'photo_type', ddl: 'ALTER TABLE employees ADD COLUMN photo_type VARCHAR(20) NULL' },
];

try {
  for (const c of cols) {
    if (!(await columnExists('employees', c.name))) {
      await pool.query(c.ddl);
      console.log(`employees.${c.name} added`);
    } else {
      console.log(`employees.${c.name} already present`);
    }
  }
  console.log('EMPLOYEE_PHOTO MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
