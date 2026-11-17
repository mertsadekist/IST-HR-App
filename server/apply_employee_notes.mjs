// Idempotent migration: HR's internal notes on an employee, each saved with the
// author's name. The same table is also created at boot by
// config/ensureSchema.js, so a redeploy needs no manual step; this script is for
// running the migrations by hand. Safe to re-run.
import pool from './config/db.js';

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS employee_notes (
     id           INT AUTO_INCREMENT PRIMARY KEY,
     company_id   INT NOT NULL,
     employee_id  INT NOT NULL,
     body         TEXT NOT NULL,
     pinned       BOOLEAN NOT NULL DEFAULT FALSE,
     created_by   INT NULL,
     author_name  VARCHAR(200) NOT NULL,
     created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at   TIMESTAMP NULL DEFAULT NULL,
     INDEX idx_emp_notes_employee (employee_id, created_at),
     INDEX idx_emp_notes_company (company_id),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('EMPLOYEE_NOTES MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
