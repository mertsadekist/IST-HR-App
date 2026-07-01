// Idempotent migration: annual Salary Review feature — companies.salary_review_approver_id
// + the salary_reviews / salary_review_items / salary_review_actions /
// salary_review_documents tables. Safe to re-run.
import pool from './config/db.js';

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]);
  return r[0].c > 0;
}

const TABLES = [
  `CREATE TABLE IF NOT EXISTS salary_reviews (
     id              INT AUTO_INCREMENT PRIMARY KEY,
     company_id      INT NOT NULL,
     review_year     INT NOT NULL,
     prepared_by     INT NOT NULL,
     status          ENUM('Draft', 'Submitted', 'Approved', 'Rejected', 'Completed') DEFAULT 'Draft',
     notes           TEXT NULL,
     submitted_at    TIMESTAMP NULL,
     decided_by      INT NULL,
     decided_at      TIMESTAMP NULL,
     decision_note   TEXT NULL,
     created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (prepared_by) REFERENCES users(id) ON DELETE RESTRICT,
     FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
     UNIQUE KEY uq_review_company_year (company_id, review_year),
     INDEX idx_review_company_status (company_id, status)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS salary_review_items (
     id                    INT AUTO_INCREMENT PRIMARY KEY,
     salary_review_id      INT NOT NULL,
     employee_id           INT NOT NULL,
     company_id            INT NOT NULL,
     current_basic_salary  DECIMAL(12, 2) NULL,
     current_full_salary   DECIMAL(12, 2) NULL,
     new_basic_salary      DECIMAL(12, 2) NULL,
     new_full_salary       DECIMAL(12, 2) NULL,
     effective_date        DATE NULL,
     job_title_id          INT NULL,
     band_min              DECIMAL(12, 2) NULL,
     band_max              DECIMAL(12, 2) NULL,
     notes                 TEXT NULL,
     status                ENUM('Pending', 'Skipped', 'Approved', 'Rejected', 'Applied') DEFAULT 'Pending',
     applied_at            TIMESTAMP NULL,
     created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     FOREIGN KEY (salary_review_id) REFERENCES salary_reviews(id) ON DELETE CASCADE,
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE SET NULL,
     INDEX idx_item_review (salary_review_id),
     INDEX idx_item_apply_due (status, effective_date)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS salary_review_actions (
     id                     INT AUTO_INCREMENT PRIMARY KEY,
     salary_review_item_id  INT NOT NULL,
     action_key             VARCHAR(50) NOT NULL,
     custom_label           VARCHAR(255) NULL,
     is_required            BOOLEAN DEFAULT TRUE,
     status                 ENUM('Pending', 'Completed', 'Skipped') DEFAULT 'Pending',
     completed_by           INT NULL,
     completed_at           TIMESTAMP NULL,
     notes                  VARCHAR(500) NULL,
     sort_order             INT DEFAULT 0,
     created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (salary_review_item_id) REFERENCES salary_review_items(id) ON DELETE CASCADE,
     FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
     INDEX idx_action_item (salary_review_item_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS salary_review_documents (
     id                     INT AUTO_INCREMENT PRIMARY KEY,
     salary_review_item_id  INT NOT NULL,
     category               ENUM('revision_letter', 'signed_contract', 'mohre_proof', 'wps_proof', 'other') DEFAULT 'other',
     file_name              VARCHAR(255) NOT NULL,
     file_type              VARCHAR(100) NULL,
     file_size              INT NULL,
     file_data              LONGBLOB NULL,
     uploaded_by            INT NULL,
     uploaded_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (salary_review_item_id) REFERENCES salary_review_items(id) ON DELETE CASCADE,
     FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
     INDEX idx_doc_item (salary_review_item_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

try {
  if (!(await columnExists('companies', 'salary_review_approver_id'))) {
    await pool.query('ALTER TABLE companies ADD COLUMN salary_review_approver_id INT NULL AFTER status, ADD FOREIGN KEY (salary_review_approver_id) REFERENCES users(id) ON DELETE SET NULL');
    console.log('companies.salary_review_approver_id added');
  } else {
    console.log('companies.salary_review_approver_id already present');
  }
  for (const ddl of TABLES) {
    await pool.query(ddl);
  }
  console.log('salary_reviews / salary_review_items / salary_review_actions / salary_review_documents ready');
  console.log('SALARY_REVIEWS MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
