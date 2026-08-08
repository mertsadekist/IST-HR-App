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
  // Credential handling — see server/apply_secret_tiers.mjs and
  // docs/secrets_protection_design.md. Reference is the default: record where
  // the secret lives, not the secret.
  { table: 'asset_assignments', column: 'secret_tier', ddl: "ALTER TABLE asset_assignments ADD COLUMN secret_tier ENUM('Reference','Delegated','Stored') NOT NULL DEFAULT 'Reference'" },
  { table: 'asset_assignments', column: 'vault_secret_reference', ddl: 'ALTER TABLE asset_assignments ADD COLUMN vault_secret_reference VARCHAR(200) NULL' },
  { table: 'asset_assignments', column: 'secret_justification', ddl: 'ALTER TABLE asset_assignments ADD COLUMN secret_justification VARCHAR(500) NULL' },
  { table: 'asset_assignments', column: 'secret_approved_by', ddl: 'ALTER TABLE asset_assignments ADD COLUMN secret_approved_by INT NULL' },
  // Envelope encryption for stored credentials — see apply_envelope_encryption.mjs
  // and docs/secrets_protection_design.md. The legacy encrypted_password columns
  // stay; a record migrates to the per-record data key on next read or write.
  { table: 'asset_assignments', column: 'dek_wrapped', ddl: 'ALTER TABLE asset_assignments ADD COLUMN dek_wrapped TEXT NULL' },
  { table: 'asset_assignments', column: 'dek_wrap_iv', ddl: 'ALTER TABLE asset_assignments ADD COLUMN dek_wrap_iv VARCHAR(64) NULL' },
  { table: 'asset_assignments', column: 'dek_wrap_tag', ddl: 'ALTER TABLE asset_assignments ADD COLUMN dek_wrap_tag VARCHAR(64) NULL' },
  { table: 'asset_assignments', column: 'key_version', ddl: 'ALTER TABLE asset_assignments ADD COLUMN key_version SMALLINT NULL' },
  { table: 'asset_assignments', column: 'aad_context', ddl: 'ALTER TABLE asset_assignments ADD COLUMN aad_context VARCHAR(200) NULL' },
  // Company-document expiry — see server/apply_document_expiry.mjs. Expiry is a
  // MODE, not just a date: not every document has an end date, and "No Expiry"
  // is a positive statement rather than an empty field.
  { table: 'company_documents', column: 'expiry_mode', ddl: "ALTER TABLE company_documents ADD COLUMN expiry_mode ENUM('Not Set','No Expiry','Has Expiry') NOT NULL DEFAULT 'Not Set'" },
  { table: 'company_documents', column: 'expiry_date', ddl: 'ALTER TABLE company_documents ADD COLUMN expiry_date DATE NULL' },
  { table: 'company_documents', column: 'issue_date', ddl: 'ALTER TABLE company_documents ADD COLUMN issue_date DATE NULL' },
  { table: 'company_documents', column: 'reminder_days', ddl: 'ALTER TABLE company_documents ADD COLUMN reminder_days SMALLINT NULL' },
  { table: 'company_documents', column: 'expiry_alert_sent', ddl: 'ALTER TABLE company_documents ADD COLUMN expiry_alert_sent VARCHAR(20) NULL' },
  { table: 'company_documents', column: 'document_name', ddl: 'ALTER TABLE company_documents ADD COLUMN document_name VARCHAR(255) NULL' },
  { table: 'company_documents', column: 'description', ddl: 'ALTER TABLE company_documents ADD COLUMN description VARCHAR(1000) NULL' },
  // Who added each candidate — see server/apply_candidate_created_by.mjs.
  // The name is snapshotted next to the FK so the record survives the account
  // being deleted, and the historical name is kept after a rename.
  { table: 'candidates', column: 'created_by', ddl: 'ALTER TABLE candidates ADD COLUMN created_by INT NULL, ADD FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL' },
  { table: 'candidates', column: 'created_by_name', ddl: 'ALTER TABLE candidates ADD COLUMN created_by_name VARCHAR(200) NULL' },
  { table: 'candidates', column: 'created_source', ddl: "ALTER TABLE candidates ADD COLUMN created_source ENUM('Manual','Careers Portal','Import') NOT NULL DEFAULT 'Manual'" },
  // Who verified a returned unit — see server/apply_inventory_lifecycle.mjs.
  // The status enum changes there are not expressible as COLUMN_GUARDS (they
  // MODIFY rather than ADD), so the migration script is the only path for those.
  { table: 'asset_inventory', column: 'inspected_by', ddl: 'ALTER TABLE asset_inventory ADD COLUMN inspected_by INT NULL' },
  { table: 'asset_inventory', column: 'inspected_at', ddl: 'ALTER TABLE asset_inventory ADD COLUMN inspected_at TIMESTAMP NULL' },
  { table: 'asset_inventory', column: 'inspection_note', ddl: 'ALTER TABLE asset_inventory ADD COLUMN inspection_note VARCHAR(500) NULL' },
];

// Tiny key/value store for global app settings (e.g. timezone).
const TABLE_GUARDS = [
  // Digital / portal / social access registry — see server/apply_digital_access.mjs
  // for the field-coverage note against the assets PRD.
  `CREATE TABLE IF NOT EXISTS digital_access (
     id                     INT AUTO_INCREMENT PRIMARY KEY,
     company_id             INT NOT NULL,
     owner_scope            ENUM('RE','MKT','GRP') NOT NULL DEFAULT 'GRP',
     platform_id            INT NULL,
     employee_id            INT NULL,
     platform_name          VARCHAR(255) NOT NULL,
     category               VARCHAR(150) NULL,
     workspace_business_name VARCHAR(255) NULL,
     account_page_name      VARCHAR(255) NULL,
     account_page_url       VARCHAR(500) NULL,
     business_portfolio_url VARCHAR(500) NULL,
     business_portfolio_id  VARCHAR(120) NULL,
     business_id            VARCHAR(120) NULL,
     ad_account_id          VARCHAR(120) NULL,
     page_channel_workspace_id VARCHAR(120) NULL,
     team_member_full_name  VARCHAR(200) NULL,
     team_member_profile_url VARCHAR(500) NULL,
     team_member_email      VARCHAR(200) NULL,
     username               VARCHAR(200) NULL,
     login_email            VARCHAR(200) NULL,
     registered_phone       VARCHAR(60) NULL,
     access_level           ENUM('No Access','Viewer','User','Editor','Moderator','Analyst','Advertiser','Admin','Super Admin','Owner') NOT NULL DEFAULT 'No Access',
     access_rank            TINYINT NOT NULL DEFAULT 0,
     page_access_level      ENUM('No Access','Viewer','User','Editor','Moderator','Analyst','Advertiser','Admin','Super Admin','Owner') NULL,
     ads_access_level       ENUM('No Access','Viewer','User','Editor','Moderator','Analyst','Advertiser','Admin','Super Admin','Owner') NULL,
     has_admin_access       BOOLEAN NOT NULL DEFAULT FALSE,
     has_owner_access       BOOLEAN NOT NULL DEFAULT FALSE,
     can_manage_users       BOOLEAN NOT NULL DEFAULT FALSE,
     seat_type              ENUM('Named seat','Pooled seat','Not a seat') NOT NULL DEFAULT 'Not a seat',
     seat_consumes_inventory BOOLEAN NOT NULL DEFAULT FALSE,
     seat_reclaimed         BOOLEAN NOT NULL DEFAULT FALSE,
     status                 ENUM('Available','Pending Activation','Assigned','Active','Suspended','Revoked','Archived') NOT NULL DEFAULT 'Pending Activation',
     assigned_on            DATE NULL,
     revoked_on             DATE NULL,
     two_factor_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
     last_access_review     DATE NULL,
     vault_secret_reference VARCHAR(200) NULL,
     managed_by             VARCHAR(150) NULL,
     notes                  VARCHAR(1000) NULL,
     created_by             INT NULL,
     created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     INDEX idx_da_company (company_id),
     INDEX idx_da_owner (owner_scope),
     INDEX idx_da_platform (platform_id),
     INDEX idx_da_employee (employee_id),
     INDEX idx_da_status (status),
     INDEX idx_da_privileged (has_admin_access, has_owner_access),
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE SET NULL,
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL,
     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // Domains, hosting and infrastructure ownership — see server/apply_domain_assets.mjs.
  // renewal_date is what the renewal scheduler watches.
  `CREATE TABLE IF NOT EXISTS domain_assets (
     id                     INT AUTO_INCREMENT PRIMARY KEY,
     company_id             INT NOT NULL,
     owner_scope            ENUM('RE','MKT','GRP') NOT NULL DEFAULT 'GRP',
     platform_id            INT NULL,
     account_or_domain_name VARCHAR(255) NOT NULL,
     domain_name            VARCHAR(255) NULL,
     registrar_provider     VARCHAR(160) NULL,
     asset_kind             ENUM('Domain','Hosting','DNS','CDN','Infrastructure','Other') NOT NULL DEFAULT 'Domain',
     account_owner          VARCHAR(200) NULL,
     technical_owner        VARCHAR(200) NULL,
     billing_owner          VARCHAR(200) NULL,
     dns_control_owner      VARCHAR(200) NULL,
     hosting_control_owner  VARCHAR(200) NULL,
     assigned_employee_id   INT NULL,
     renewal_date           DATE NULL,
     auto_renew             BOOLEAN NOT NULL DEFAULT FALSE,
     renewal_alert_sent     VARCHAR(20) NULL,
     account_status         ENUM('Active','Pending','Expired','Transferred','Cancelled') NOT NULL DEFAULT 'Active',
     vault_secret_reference VARCHAR(200) NULL,
     notes                  VARCHAR(1000) NULL,
     created_by             INT NULL,
     created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     INDEX idx_da_company (company_id),
     INDEX idx_da_owner (owner_scope),
     INDEX idx_da_renewal (renewal_date),
     INDEX idx_da_status (account_status),
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE SET NULL,
     FOREIGN KEY (assigned_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
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

// Enum values that must exist, widened in place. COLUMN_GUARDS only covers
// ADD COLUMN; these need MODIFY, and a missing value is not a cosmetic gap —
// a deploy whose users.role enum predates `accountant` would reject every
// attempt to create that user with a silent truncation error.
const ENUM_GUARDS = [
  { table: 'users', column: 'role', values: ['accountant'], suffix: " DEFAULT 'employee'" },
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
  for (const g of ENUM_GUARDS) {
    try {
      const [[col]] = await pool.query(
        'SELECT COLUMN_TYPE FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?',
        [g.table, g.column]
      );
      if (!col) continue;
      const missing = g.values.filter((v) => !col.COLUMN_TYPE.includes(`'${v}'`));
      if (!missing.length) continue;
      // Keep every value already in the column — an older deploy may carry one
      // this build has never heard of, and dropping it would orphan those rows.
      const existing = (col.COLUMN_TYPE.match(/'([^']+)'/g) || []).map((s) => s.slice(1, -1));
      const list = [...new Set([...existing, ...missing])].map((v) => `'${v}'`).join(',');
      await pool.query(`ALTER TABLE ${g.table} MODIFY COLUMN ${g.column} ENUM(${list})${g.suffix || ''}`);
      console.log(`🔧 ensureSchema: widened ${g.table}.${g.column} with ${missing.join(', ')}`);
    } catch (e) {
      console.error(`ensureSchema(enum ${g.table}.${g.column}) failed:`, e.message);
    }
  }
}
