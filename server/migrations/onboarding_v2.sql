-- ============================================================================
-- Onboarding module rebuild v2 (stage-based workflow). Idempotent where possible.
-- See docs/modules/onboarding_v2_redesign.md
-- ============================================================================

-- NOTE on the spine: ALTER ... ADD COLUMN IF NOT EXISTS / MODIFY require care on
-- older MySQL. The apply runner (apply_onboarding_v2.mjs) checks information_schema
-- and only adds what is missing. The statements below are the canonical target.

ALTER TABLE onboarding_records
  ADD COLUMN stage ENUM('DRAFT','CV_UPLOADED','UNDER_HR_REVIEW','HR_APPROVED','OFFER_SENT',
      'OFFER_ACCEPTED','SIGNED_OFFER_UPLOADED','DOCUMENTS_COLLECTION','VISA_RESIDENCY',
      'BANK_DETAILS','READY_FOR_EMPLOYMENT','COMPLETED','REJECTED','CANCELLED')
      NOT NULL DEFAULT 'DRAFT' AFTER status,
  ADD COLUMN candidate_id INT NULL,
  ADD COLUMN vacancy_id INT NULL,
  ADD COLUMN offer_state ENUM('none','sent','accepted','rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN rejection_reason TEXT NULL,
  ADD COLUMN assigned_to INT NULL,
  ADD COLUMN created_by INT NULL,
  ADD INDEX idx_onb_stage (company_id, stage);

CREATE TABLE IF NOT EXISTS onboarding_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL UNIQUE,
  company_id INT NOT NULL,
  first_name VARCHAR(100) NULL, last_name VARCHAR(100) NULL, full_name VARCHAR(200) NULL,
  email VARCHAR(255) NULL, phone VARCHAR(50) NULL, address VARCHAR(500) NULL,
  nationality VARCHAR(100) NULL, date_of_birth DATE NULL, gender VARCHAR(20) NULL, marital_status VARCHAR(20) NULL,
  current_job_title VARCHAR(200) NULL, total_experience_years DECIMAL(4,1) NULL,
  education JSON NULL, skills JSON NULL, languages JSON NULL,
  work_experience JSON NULL, certifications JSON NULL,
  extracted_data JSON NULL, extracted_fields JSON NULL,
  profile_verified BOOLEAN DEFAULT FALSE, profile_completeness INT DEFAULT 0,
  cv_file_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  decision ENUM('Pending','Approved','Rejected','More Info') DEFAULT 'Pending',
  decided_by INT NULL, decided_at TIMESTAMP NULL,
  decision_note TEXT NULL, rejection_reason TEXT NULL,
  INDEX idx_appr_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  offer_number VARCHAR(40) NULL, version INT DEFAULT 1,
  candidate_name VARCHAR(200) NULL, job_title VARCHAR(200) NULL, department VARCHAR(150) NULL,
  reporting_manager VARCHAR(150) NULL, work_location VARCHAR(200) NULL,
  employment_type ENUM('Full-time','Part-time','Contract','Temporary') DEFAULT 'Full-time',
  joining_date DATE NULL, basic_salary DECIMAL(12,2) NULL, allowances JSON NULL,
  commission_structure TEXT NULL, probation_period VARCHAR(100) NULL, working_hours VARCHAR(100) NULL,
  leave_policy VARCHAR(255) NULL, benefits TEXT NULL, visa_responsibility VARCHAR(255) NULL,
  medical_insurance VARCHAR(255) NULL, notice_period VARCHAR(100) NULL,
  offer_expiry_date DATE NULL, additional_terms TEXT NULL, internal_notes TEXT NULL,
  status ENUM('Draft','Sent','Accepted','Rejected','Expired','Withdrawn') DEFAULT 'Draft',
  response ENUM('Pending','Accepted','Rejected') DEFAULT 'Pending',
  rejection_reason TEXT NULL,
  created_by INT NULL, sent_by INT NULL, sent_at TIMESTAMP NULL, responded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_offer_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  kind VARCHAR(40) NOT NULL, ref_id INT NULL,
  file_name VARCHAR(255) NULL, file_type VARCHAR(100) NULL, file_size INT NULL,
  storage_key VARCHAR(500) NULL, is_current BOOLEAN DEFAULT TRUE,
  uploaded_by INT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_file_onb (onboarding_id, kind),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_signed_offer (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL UNIQUE, company_id INT NOT NULL,
  file_id INT NULL, signatories JSON NULL,
  verification_status ENUM('Pending','Verified','Rejected') DEFAULT 'Pending',
  verified_by INT NULL, verified_at TIMESTAMP NULL, notes TEXT NULL,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  doc_key VARCHAR(60) NULL, label VARCHAR(200) NULL, required BOOLEAN DEFAULT TRUE,
  file_id INT NULL, status ENUM('Missing','Uploaded','Pending','Verified','Rejected','Expired') DEFAULT 'Missing',
  expiry_date DATE NULL, verified_by INT NULL, verified_at TIMESTAMP NULL, notes VARCHAR(500) NULL,
  INDEX idx_doc_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_visa_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  step_key VARCHAR(60) NULL, label VARCHAR(200) NULL, required BOOLEAN DEFAULT TRUE, sort_order INT DEFAULT 0,
  status ENUM('Not Started','In Progress','Submitted','Approved','Completed','Rejected') DEFAULT 'Not Started',
  reference_number VARCHAR(120) NULL, responsible_user INT NULL, due_date DATE NULL,
  file_id INT NULL, notes VARCHAR(500) NULL, completed_at TIMESTAMP NULL,
  INDEX idx_visa_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_bank_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL UNIQUE, company_id INT NOT NULL,
  bank_name VARCHAR(150) NULL, account_holder_name VARCHAR(200) NULL, account_number VARCHAR(60) NULL,
  iban VARCHAR(60) NULL, swift_code VARCHAR(30) NULL, branch_name VARCHAR(150) NULL,
  transfer_method ENUM('Bank Transfer','WPS','Cheque','Cash') DEFAULT 'Bank Transfer',
  confirmation_file_id INT NULL, verified BOOLEAN DEFAULT FALSE, verified_by INT NULL, verified_at TIMESTAMP NULL,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  user_id INT NULL, body TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comment_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  user_id INT NULL, user_name VARCHAR(200) NULL,
  event_type VARCHAR(80) NULL, from_stage VARCHAR(40) NULL, to_stage VARCHAR(40) NULL,
  detail TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_onb (onboarding_id, created_at),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
