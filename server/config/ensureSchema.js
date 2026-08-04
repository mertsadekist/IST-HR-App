import pool from './db.js';

// Idempotent, self-healing column guards applied at boot, so a redeploy never
// needs a manual migration step for these additive columns. Fails soft: a guard
// error is logged but never crashes the server.
const COLUMN_GUARDS = [
  { table: 'employees', column: 'attendance_id', ddl: 'ALTER TABLE employees ADD COLUMN attendance_id VARCHAR(100) NULL' },
  {
    table: 'companies', column: 'salary_review_approver_id',
    ddl: 'ALTER TABLE companies ADD COLUMN salary_review_approver_id INT NULL, ADD FOREIGN KEY (salary_review_approver_id) REFERENCES users(id) ON DELETE SET NULL',
  },
  // "How did you hear about us?" on the public careers form.
  { table: 'job_applications', column: 'heard_about_us', ddl: 'ALTER TABLE job_applications ADD COLUMN heard_about_us VARCHAR(60) NULL' },
  { table: 'job_applications', column: 'referrer_name', ddl: 'ALTER TABLE job_applications ADD COLUMN referrer_name VARCHAR(200) NULL' },
  // Labour contract / work residency issued? Drives the probation notice.
  {
    table: 'employees', column: 'labour_contract_status',
    ddl: "ALTER TABLE employees ADD COLUMN labour_contract_status ENUM('Not Issued','Issued') NOT NULL DEFAULT 'Not Issued'",
  },
  { table: 'employees', column: 'labour_contract_issued_at', ddl: 'ALTER TABLE employees ADD COLUMN labour_contract_issued_at DATE NULL' },
  // Official mail domains owned by the company (comma-separated).
  { table: 'companies', column: 'email_domains', ddl: 'ALTER TABLE companies ADD COLUMN email_domains VARCHAR(500) NULL' },
  // Employee profile picture (file on the uploads volume, not inline base64).
  { table: 'employees', column: 'photo_path', ddl: 'ALTER TABLE employees ADD COLUMN photo_path VARCHAR(512) NULL' },
  { table: 'employees', column: 'photo_type', ddl: 'ALTER TABLE employees ADD COLUMN photo_type VARCHAR(20) NULL' },
  // Leave: who actually approved (may not be a system user), and Full/Half/None pay.
  { table: 'leave_requests', column: 'approver_name', ddl: 'ALTER TABLE leave_requests ADD COLUMN approver_name VARCHAR(200) NULL' },
  { table: 'leave_types', column: 'paid_mode', ddl: "ALTER TABLE leave_types ADD COLUMN paid_mode ENUM('Full','Half','None') NOT NULL DEFAULT 'Full'" },
  { table: 'onboarding_bank_details', column: 'iban_letter_file_id', ddl: 'ALTER TABLE onboarding_bank_details ADD COLUMN iban_letter_file_id INT NULL' },
  // Identifiers required by the UAE WPS salary file — see server/apply_wps_fields.mjs.
  // VARCHAR, not numeric: leading zeros are significant.
  { table: 'employees', column: 'work_permit_no', ddl: 'ALTER TABLE employees ADD COLUMN work_permit_no VARCHAR(20) NULL' },
  { table: 'employees', column: 'personal_no', ddl: 'ALTER TABLE employees ADD COLUMN personal_no VARCHAR(20) NULL' },
  { table: 'companies', column: 'mol_id', ddl: 'ALTER TABLE companies ADD COLUMN mol_id VARCHAR(30) NULL' },
  { table: 'companies', column: 'wps_contact_person', ddl: 'ALTER TABLE companies ADD COLUMN wps_contact_person VARCHAR(150) NULL' },
  { table: 'companies', column: 'wps_contact_mobile', ddl: 'ALTER TABLE companies ADD COLUMN wps_contact_mobile VARCHAR(40) NULL' },
  { table: 'companies', column: 'wps_contact_phone', ddl: 'ALTER TABLE companies ADD COLUMN wps_contact_phone VARCHAR(40) NULL' },
  { table: 'companies', column: 'wps_contact_fax', ddl: 'ALTER TABLE companies ADD COLUMN wps_contact_fax VARCHAR(40) NULL' },
  { table: 'companies', column: 'wps_contact_email', ddl: 'ALTER TABLE companies ADD COLUMN wps_contact_email VARCHAR(150) NULL' },
  // Company ownership of assets — see server/apply_asset_ownership.mjs.
  // GRP = shared by IST Real Estate and IST Markets, which company_id alone
  // cannot express. Defaults to GRP so an unclassified asset stays visible.
  { table: 'platform_catalog', column: 'owner_scope', ddl: "ALTER TABLE platform_catalog ADD COLUMN owner_scope ENUM('RE','MKT','GRP') NOT NULL DEFAULT 'GRP'" },
  { table: 'platform_catalog', column: 'alias_of', ddl: 'ALTER TABLE platform_catalog ADD COLUMN alias_of VARCHAR(255) NULL' },
  { table: 'platform_catalog', column: 'application_url', ddl: 'ALTER TABLE platform_catalog ADD COLUMN application_url VARCHAR(500) NULL' },
  { table: 'platform_catalog', column: 'development_type', ddl: 'ALTER TABLE platform_catalog ADD COLUMN development_type VARCHAR(50) NULL' },
  { table: 'asset_categories', column: 'examples', ddl: 'ALTER TABLE asset_categories ADD COLUMN examples VARCHAR(1000) NULL' },
  { table: 'asset_categories', column: 'purpose', ddl: 'ALTER TABLE asset_categories ADD COLUMN purpose VARCHAR(1000) NULL' },
  { table: 'asset_categories', column: 'recommended_owner', ddl: 'ALTER TABLE asset_categories ADD COLUMN recommended_owner VARCHAR(200) NULL' },
  { table: 'asset_assignments', column: 'owner_scope', ddl: "ALTER TABLE asset_assignments ADD COLUMN owner_scope ENUM('RE','MKT','GRP') NOT NULL DEFAULT 'GRP'" },
  { table: 'asset_inventory', column: 'owner_scope', ddl: "ALTER TABLE asset_inventory ADD COLUMN owner_scope ENUM('RE','MKT','GRP') NOT NULL DEFAULT 'GRP'" },
];

// Tiny key/value store for global app settings (e.g. timezone).
const TABLE_GUARDS = [
  `CREATE TABLE IF NOT EXISTS app_settings (
     k VARCHAR(100) PRIMARY KEY,
     v TEXT NULL,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // Annual Salary Review — see server/apply_salary_reviews.mjs for full context.
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
  // Admin-configurable Onboarding v2 checklists — see server/apply_onboarding_checklist_templates.mjs.
  `CREATE TABLE IF NOT EXISTS onboarding_document_templates (
     id          INT AUTO_INCREMENT PRIMARY KEY,
     company_id  INT NOT NULL,
     doc_key     VARCHAR(60) NOT NULL,
     label       VARCHAR(200) NOT NULL,
     required    BOOLEAN NOT NULL DEFAULT TRUE,
     sort_order  INT NOT NULL DEFAULT 0,
     created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     INDEX idx_doc_tpl_company (company_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS onboarding_visa_templates (
     id          INT AUTO_INCREMENT PRIMARY KEY,
     company_id  INT NOT NULL,
     step_key    VARCHAR(60) NOT NULL,
     label       VARCHAR(200) NOT NULL,
     required    BOOLEAN NOT NULL DEFAULT TRUE,
     sort_order  INT NOT NULL DEFAULT 0,
     created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     INDEX idx_visa_tpl_company (company_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // Per-employee payroll bank account + the bank-stamped IBAN letter.
  // See server/apply_employee_bank.mjs for why this is separate from onboarding.
  `CREATE TABLE IF NOT EXISTS employee_bank_details (
     id                  INT AUTO_INCREMENT PRIMARY KEY,
     employee_id         INT NOT NULL UNIQUE,
     company_id          INT NOT NULL,
     bank_name           VARCHAR(150) NULL,
     account_holder_name VARCHAR(200) NULL,
     account_number      VARCHAR(60) NULL,
     iban                VARCHAR(60) NULL,
     swift_code          VARCHAR(30) NULL,
     branch_name         VARCHAR(150) NULL,
     transfer_method     ENUM('Bank Transfer','WPS','Cheque','Cash') DEFAULT 'Bank Transfer',
     salary_currency     VARCHAR(10) NULL,
     notes               VARCHAR(500) NULL,
     verified            BOOLEAN NOT NULL DEFAULT FALSE,
     verified_by         INT NULL,
     verified_at         TIMESTAMP NULL,
     created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
     INDEX idx_emp_bank_company (company_id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS employee_bank_files (
     id           INT AUTO_INCREMENT PRIMARY KEY,
     employee_id  INT NOT NULL,
     company_id   INT NOT NULL,
     kind         ENUM('iban_letter','other') NOT NULL DEFAULT 'iban_letter',
     file_name    VARCHAR(255) NULL,
     file_type    VARCHAR(100) NULL,
     file_size    INT NULL,
     storage_key  VARCHAR(500) NOT NULL,
     uploaded_by  INT NULL,
     uploaded_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_emp_bank_file (employee_id, kind),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // Scanned proof attached to a leave request — see server/apply_leave_docs.mjs.
  `CREATE TABLE IF NOT EXISTS leave_files (
     id               INT AUTO_INCREMENT PRIMARY KEY,
     leave_request_id INT NOT NULL,
     company_id       INT NOT NULL,
     kind             ENUM('request_proof','approval_proof') NOT NULL DEFAULT 'request_proof',
     file_name        VARCHAR(255) NULL,
     file_type        VARCHAR(100) NULL,
     file_size        INT NULL,
     storage_key      VARCHAR(500) NOT NULL,
     uploaded_by      INT NULL,
     uploaded_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_leave_file_req (leave_request_id, kind),
     FOREIGN KEY (leave_request_id) REFERENCES leave_requests(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

export async function ensureSchema() {
  for (const ddl of TABLE_GUARDS) {
    try { await pool.query(ddl); } catch (e) { console.error('ensureSchema(table) failed:', e.message); }
  }
  for (const g of COLUMN_GUARDS) {
    try {
      const [r] = await pool.query(
        'SELECT COUNT(*) c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
        [g.table, g.column]
      );
      if (r[0].c === 0) {
        await pool.query(g.ddl);
        console.log(`🔧 ensureSchema: added ${g.table}.${g.column}`);
      }
    } catch (e) {
      console.error(`ensureSchema(${g.table}.${g.column}) failed:`, e.message);
    }
  }
}
