import pool from './db.js';

// Idempotent, self-healing column guards applied at boot, so a redeploy never
// needs a manual migration step for these additive columns. Fails soft: a guard
// error is logged but never crashes the server.
const COLUMN_GUARDS = [
  { table: 'employees', column: 'attendance_id', ddl: 'ALTER TABLE employees ADD COLUMN attendance_id VARCHAR(100) NULL' },
  // Company owner: exempt from attendance tracking — see server/services/ownerExemption.js.
  { table: 'employees', column: 'is_owner', ddl: 'ALTER TABLE employees ADD COLUMN is_owner BOOLEAN NOT NULL DEFAULT FALSE' },
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
  // How many door punches a Hik Central day was built from — see
  // server/apply_attendance_hik_sync.mjs. NULL for rows that predate it.
  { table: 'attendance', column: 'punch_count', ddl: 'ALTER TABLE attendance ADD COLUMN punch_count SMALLINT NULL' },
  // Payroll v2: who submitted, who sent it back and why, and any recorded override.
  { table: 'payroll_runs', column: 'submitted_by', ddl: 'ALTER TABLE payroll_runs ADD COLUMN submitted_by INT NULL' },
  { table: 'payroll_runs', column: 'submitted_at', ddl: 'ALTER TABLE payroll_runs ADD COLUMN submitted_at TIMESTAMP NULL' },
  { table: 'payroll_runs', column: 'rejected_by', ddl: 'ALTER TABLE payroll_runs ADD COLUMN rejected_by INT NULL' },
  { table: 'payroll_runs', column: 'rejected_at', ddl: 'ALTER TABLE payroll_runs ADD COLUMN rejected_at TIMESTAMP NULL' },
  { table: 'payroll_runs', column: 'rejection_reason', ddl: 'ALTER TABLE payroll_runs ADD COLUMN rejection_reason VARCHAR(500) NULL' },
  { table: 'payroll_runs', column: 'check_override_reason', ddl: 'ALTER TABLE payroll_runs ADD COLUMN check_override_reason VARCHAR(500) NULL' },
  { table: 'payroll_runs', column: 'self_approval_reason', ddl: 'ALTER TABLE payroll_runs ADD COLUMN self_approval_reason VARCHAR(500) NULL' },
  { table: 'payroll_runs', column: 'payslips_notified_at', ddl: 'ALTER TABLE payroll_runs ADD COLUMN payslips_notified_at TIMESTAMP NULL' },
  // One-time earnings paid on top of gross (bonus, commission…): the WPS variable portion.
  { table: 'payroll_items', column: 'additions', ddl: 'ALTER TABLE payroll_items ADD COLUMN additions DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER gross' },
  // Final settlement (services/settlementService.js): its own status, who
  // prepared, approved and paid it, and how — paid is final, so it is paid once.
  { table: 'offboarding_records', column: 'settlement_status', ddl: "ALTER TABLE offboarding_records ADD COLUMN settlement_status ENUM('Not Started','Draft','Approved','Paid') NOT NULL DEFAULT 'Not Started'" },
  { table: 'offboarding_records', column: 'final_salary', ddl: 'ALTER TABLE offboarding_records ADD COLUMN final_salary DECIMAL(12,2) NULL' },
  { table: 'offboarding_records', column: 'settlement_inputs', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_inputs JSON NULL' },
  { table: 'offboarding_records', column: 'settlement_prepared_by', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_prepared_by INT NULL' },
  { table: 'offboarding_records', column: 'settlement_prepared_at', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_prepared_at TIMESTAMP NULL' },
  { table: 'offboarding_records', column: 'settlement_approved_by', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_approved_by INT NULL' },
  { table: 'offboarding_records', column: 'settlement_approved_at', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_approved_at TIMESTAMP NULL' },
  { table: 'offboarding_records', column: 'settlement_override_reason', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_override_reason VARCHAR(500) NULL' },
  { table: 'offboarding_records', column: 'settlement_paid_at', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_paid_at DATE NULL' },
  { table: 'offboarding_records', column: 'settlement_payment_ref', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_payment_ref VARCHAR(120) NULL' },
  { table: 'offboarding_records', column: 'settlement_paid_by', ddl: 'ALTER TABLE offboarding_records ADD COLUMN settlement_paid_by INT NULL' },
  // A one-time item paid by a settlement rather than a monthly run.
  { table: 'payroll_adjustments', column: 'settlement_id', ddl: 'ALTER TABLE payroll_adjustments ADD COLUMN settlement_id INT NULL' },
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
  // Work schedules and the holiday calendar — see server/apply_work_schedules.mjs
  // and docs/attendance_schedules_and_exceptions_plan.md. Reference data only:
  // nothing reads these yet, and the attendance evaluator that will arrives in
  // Phase 2. The seeded IST schedules come from the migration, not from here —
  // a boot-time guard must never invent business data.
  //
  // weekday is 0 = Sunday … 6 = Saturday (JS getDay(), MySQL DAYOFWEEK() - 1).
  `CREATE TABLE IF NOT EXISTS work_schedules (
     id                 INT AUTO_INCREMENT PRIMARY KEY,
     company_id         INT NOT NULL,
     name_en            VARCHAR(150) NOT NULL,
     name_ar            VARCHAR(150) NULL,
     timezone           VARCHAR(60) NOT NULL DEFAULT 'Asia/Dubai',
     grace_in_minutes   SMALLINT NOT NULL DEFAULT 10,
     grace_out_minutes  SMALLINT NOT NULL DEFAULT 10,
     late_case_minutes  SMALLINT NOT NULL DEFAULT 30,
     early_case_minutes SMALLINT NOT NULL DEFAULT 30,
     half_day_threshold_pct TINYINT NOT NULL DEFAULT 50,
     is_default         BOOLEAN NOT NULL DEFAULT FALSE,
     active             BOOLEAN NOT NULL DEFAULT TRUE,
     notes              VARCHAR(500) NULL,
     created_by         INT NULL,
     created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
     UNIQUE KEY uq_ws_company_name (company_id, name_en),
     INDEX idx_ws_company (company_id, active),
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS work_schedule_days (
     id            INT AUTO_INCREMENT PRIMARY KEY,
     schedule_id   INT NOT NULL,
     weekday       TINYINT NOT NULL,
     is_working    BOOLEAN NOT NULL DEFAULT TRUE,
     start_time    TIME NULL,
     end_time      TIME NULL,
     break_minutes SMALLINT NOT NULL DEFAULT 0,
     UNIQUE KEY uq_wsd_schedule_day (schedule_id, weekday),
     FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS employee_work_schedules (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     employee_id    INT NOT NULL,
     schedule_id    INT NOT NULL,
     company_id     INT NOT NULL,
     effective_from DATE NOT NULL,
     effective_to   DATE NULL,
     note           VARCHAR(300) NULL,
     assigned_by    INT NULL,
     created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_ews_emp_from (employee_id, effective_from),
     INDEX idx_ews_lookup (employee_id, effective_from),
     INDEX idx_ews_company (company_id),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (schedule_id) REFERENCES work_schedules(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS holidays (
     id           INT AUTO_INCREMENT PRIMARY KEY,
     company_id   INT NULL,
     holiday_date DATE NOT NULL,
     name_en      VARCHAR(150) NOT NULL,
     name_ar      VARCHAR(150) NULL,
     is_half_day  BOOLEAN NOT NULL DEFAULT FALSE,
     notes        VARCHAR(300) NULL,
     created_by   INT NULL,
     created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_holiday_company_date (company_id, holiday_date),
     INDEX idx_holiday_date (holiday_date),
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
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
  // One row per Hik Central sync pass worth remembering — see
  // server/apply_attendance_hik_sync.mjs for why each column exists.
  `CREATE TABLE IF NOT EXISTS hik_sync_runs (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     trigger_type   ENUM('Live','Scheduled','Manual','Backfill') NOT NULL DEFAULT 'Live',
     status         ENUM('Running','Completed','Failed') NOT NULL DEFAULT 'Running',
     date_from      DATE NULL,
     date_to        DATE NULL,
     events_read    INT NOT NULL DEFAULT 0,
     rows_inserted  SMALLINT NOT NULL DEFAULT 0,
     rows_updated   SMALLINT NOT NULL DEFAULT 0,
     rows_unchanged SMALLINT NOT NULL DEFAULT 0,
     absences       SMALLINT NOT NULL DEFAULT 0,
     summary        JSON NULL,
     error          VARCHAR(1000) NULL,
     started_by     INT NULL,
     started_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     finished_at    TIMESTAMP NULL,
     claim_key      VARCHAR(32) NULL,
     UNIQUE KEY uq_hik_run_claim (claim_key),
     INDEX idx_hik_run_started (started_at)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // ── Payroll v2 (services/payrollV2.js) ──────────────────────────────────────
  // What an allowance can be. The contract total stays employees.full_salary;
  // these only break the allowance part of it down for the payslip.
  `CREATE TABLE IF NOT EXISTS pay_component_types (
     id         INT AUTO_INCREMENT PRIMARY KEY,
     code       VARCHAR(30) NOT NULL,
     name_en    VARCHAR(100) NOT NULL,
     name_ar    VARCHAR(100) NOT NULL,
     sort_order SMALLINT NOT NULL DEFAULT 0,
     active     BOOLEAN NOT NULL DEFAULT TRUE,
     UNIQUE KEY uq_pay_component_code (code)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `INSERT IGNORE INTO pay_component_types (code, name_en, name_ar, sort_order) VALUES
     ('HOUSING', 'Housing allowance', 'بدل السكن', 10),
     ('TRANSPORT', 'Transport allowance', 'بدل المواصلات', 20),
     ('FOOD', 'Food allowance', 'بدل الطعام', 30),
     ('PHONE', 'Phone allowance', 'بدل الهاتف', 40),
     ('OTHER', 'Other allowance', 'بدل آخر', 90)`,
  `CREATE TABLE IF NOT EXISTS employee_pay_components (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     employee_id    INT NOT NULL,
     company_id     INT NOT NULL,
     component_code VARCHAR(30) NOT NULL,
     amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
     effective_from DATE NULL,
     effective_to   DATE NULL,
     updated_by     INT NULL,
     created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_epc_employee (employee_id),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // One row per payslip line, written with the item it explains.
  `CREATE TABLE IF NOT EXISTS payroll_item_lines (
     id          INT AUTO_INCREMENT PRIMARY KEY,
     item_id     INT NOT NULL,
     run_id      INT NOT NULL,
     employee_id INT NOT NULL,
     kind        ENUM('earning','deduction') NOT NULL,
     code        VARCHAR(40) NOT NULL,
     label       VARCHAR(150) NOT NULL,
     quantity    DECIMAL(8,2) NULL,
     rate        DECIMAL(12,2) NULL,
     amount      DECIMAL(12,2) NOT NULL DEFAULT 0,
     explanation VARCHAR(500) NULL,
     sort_order  SMALLINT NOT NULL DEFAULT 0,
     INDEX idx_pil_item (item_id),
     INDEX idx_pil_run (run_id),
     FOREIGN KEY (item_id) REFERENCES payroll_items(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // ── Loans, salary advances and one-time pay items ───────────────────────────
  // A loan is repaid in instalments by payroll from its start month. What has
  // been repaid is the sum of its repayment rows, each tied to the payroll item
  // that took it — so deleting or regenerating a Draft run gives the money back.
  `CREATE TABLE IF NOT EXISTS employee_loans (
     id            INT AUTO_INCREMENT PRIMARY KEY,
     company_id    INT NOT NULL,
     employee_id   INT NOT NULL,
     type          ENUM('Loan','Advance') NOT NULL DEFAULT 'Loan',
     principal     DECIMAL(12,2) NOT NULL,
     instalment    DECIMAL(12,2) NOT NULL,
     start_period  CHAR(7) NOT NULL,
     status        ENUM('Active','Settled','Cancelled') NOT NULL DEFAULT 'Active',
     reason        VARCHAR(500) NULL,
     created_by    INT NULL,
     created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     closed_by     INT NULL,
     closed_at     TIMESTAMP NULL,
     close_note    VARCHAR(500) NULL,
     INDEX idx_loan_employee (employee_id),
     INDEX idx_loan_company_status (company_id, status),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS loan_repayments (
     id       INT AUTO_INCREMENT PRIMARY KEY,
     loan_id  INT NOT NULL,
     run_id   INT NOT NULL,
     item_id  INT NOT NULL,
     period   CHAR(7) NOT NULL,
     amount   DECIMAL(12,2) NOT NULL,
     INDEX idx_lr_loan (loan_id),
     FOREIGN KEY (loan_id) REFERENCES employee_loans(id) ON DELETE CASCADE,
     FOREIGN KEY (item_id) REFERENCES payroll_items(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // One-time earnings or deductions for one month. run_id/item_id record which
  // payroll item paid it; once that run is approved the item is locked.
  `CREATE TABLE IF NOT EXISTS payroll_adjustments (
     id          INT AUTO_INCREMENT PRIMARY KEY,
     company_id  INT NOT NULL,
     employee_id INT NOT NULL,
     period      CHAR(7) NOT NULL,
     kind        ENUM('earning','deduction') NOT NULL,
     category    ENUM('Bonus','Commission','Allowance','Reimbursement','Overtime','Deduction','Other') NOT NULL DEFAULT 'Other',
     label       VARCHAR(150) NOT NULL,
     amount      DECIMAL(12,2) NOT NULL,
     note        VARCHAR(500) NULL,
     run_id      INT NULL,
     item_id     INT NULL,
     created_by  INT NULL,
     created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     INDEX idx_adj_company_period (company_id, period),
     INDEX idx_adj_employee (employee_id),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (item_id) REFERENCES payroll_items(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  // The lines of a final settlement. 'auto' lines are rewritten on every
  // recalculation; 'manual' lines (notice pay, damages…) are HR's and kept.
  // Overtime (services/overtimeService.js). One record per employee-day:
  // detected or entered as Pending, approved (possibly for fewer minutes) or
  // rejected, then paid by the payroll item — or final settlement — that took it.
  `CREATE TABLE IF NOT EXISTS overtime_records (
     id               INT AUTO_INCREMENT PRIMARY KEY,
     company_id       INT NOT NULL,
     employee_id      INT NOT NULL,
     work_date        DATE NOT NULL,
     source           ENUM('Detected','Manual') NOT NULL DEFAULT 'Detected',
     check_in         VARCHAR(8) NULL,
     check_out        VARCHAR(8) NULL,
     normal_minutes   SMALLINT NOT NULL DEFAULT 0,
     night_minutes    SMALLINT NOT NULL DEFAULT 0,
     rest_minutes     SMALLINT NOT NULL DEFAULT 0,
     status           ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
     approved_normal  SMALLINT NULL,
     approved_night   SMALLINT NULL,
     approved_rest    SMALLINT NULL,
     reason           VARCHAR(500) NULL,
     decision_note    VARCHAR(500) NULL,
     decided_by       INT NULL,
     decided_at       TIMESTAMP NULL,
     amount           DECIMAL(12,2) NULL,
     run_id           INT NULL,
     item_id          INT NULL,
     settlement_id    INT NULL,
     created_by       INT NULL,
     created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY uq_ot_employee_date (employee_id, work_date),
     INDEX idx_ot_company_date (company_id, work_date),
     INDEX idx_ot_status (status),
     FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
     FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
     FOREIGN KEY (item_id) REFERENCES payroll_items(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  `CREATE TABLE IF NOT EXISTS offboarding_settlement_lines (
     id             INT AUTO_INCREMENT PRIMARY KEY,
     offboarding_id INT NOT NULL,
     kind           ENUM('earning','deduction') NOT NULL,
     code           VARCHAR(40) NOT NULL,
     label          VARCHAR(150) NOT NULL,
     quantity       DECIMAL(8,2) NULL,
     rate           DECIMAL(12,2) NULL,
     amount         DECIMAL(12,2) NOT NULL DEFAULT 0,
     explanation    VARCHAR(500) NULL,
     source         ENUM('auto','manual') NOT NULL DEFAULT 'auto',
     ref_id         INT NULL,
     sort_order     SMALLINT NOT NULL DEFAULT 0,
     INDEX idx_osl_offboarding (offboarding_id),
     FOREIGN KEY (offboarding_id) REFERENCES offboarding_records(id) ON DELETE CASCADE
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

// Enum values that must exist, widened in place. COLUMN_GUARDS only covers
// ADD COLUMN; these need MODIFY, and a missing value is not a cosmetic gap —
// a deploy whose users.role enum predates `accountant` would reject every
// attempt to create that user with a silent truncation error.
const ENUM_GUARDS = [
  { table: 'users', column: 'role', values: ['accountant'], suffix: " DEFAULT 'employee'" },
  // Rows written by the Hik Central sync. 'Drive Sync' stays in the list: those
  // rows are history and must not be orphaned by widening the column.
  { table: 'attendance', column: 'source', values: ['Hik Central', 'Self Service'], suffix: " NOT NULL DEFAULT 'Manual'" },
  // Payroll v2: a run is submitted for approval before it is approved.
  { table: 'payroll_runs', column: 'status', values: ['Pending Approval'], suffix: " NOT NULL DEFAULT 'Draft'" },
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
