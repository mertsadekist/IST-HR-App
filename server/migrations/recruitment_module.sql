-- ============================================================================
-- Recruitment landing page & ATS module. New tables (idempotent).
-- vacancies column additions + status ENUM widening are handled by
-- apply_recruitment.mjs (information_schema-guarded). See
-- docs/modules/recruitment_landing_redesign.md
-- ============================================================================

CREATE TABLE IF NOT EXISTS job_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  vacancy_id INT NOT NULL,
  candidate_id INT NOT NULL,
  stage VARCHAR(40) NOT NULL DEFAULT 'New Application',
  status ENUM('Open','Hired','Rejected','Archived') NOT NULL DEFAULT 'Open',
  rating TINYINT NULL,
  assigned_to INT NULL,
  source VARCHAR(80) NULL,
  utm_source VARCHAR(120) NULL, utm_medium VARCHAR(120) NULL, utm_campaign VARCHAR(120) NULL,
  utm_content VARCHAR(120) NULL, utm_term VARCHAR(120) NULL,
  current_location VARCHAR(200) NULL, current_job_title VARCHAR(200) NULL,
  years_experience DECIMAL(4,1) NULL, expected_salary VARCHAR(60) NULL,
  notice_period VARCHAR(60) NULL, available_date DATE NULL,
  linkedin_url VARCHAR(300) NULL, portfolio_url VARCHAR(300) NULL,
  cover_letter TEXT NULL, answers JSON NULL,
  cv_file_id INT NULL, onboarding_id INT NULL,
  next_action VARCHAR(255) NULL, follow_up_at DATE NULL, rejection_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_appn_company_stage (company_id, stage),
  INDEX idx_appn_vacancy (vacancy_id),
  INDEX idx_appn_candidate (candidate_id),
  UNIQUE KEY uq_appn_vacancy_candidate (vacancy_id, candidate_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE CASCADE,
  FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS application_consents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  vacancy_id INT NOT NULL,
  application_id INT NULL,
  candidate_email VARCHAR(255) NULL,
  accepted BOOLEAN NOT NULL DEFAULT FALSE,
  policy_version VARCHAR(40) NULL,
  ip_address VARCHAR(64) NULL,
  consented_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_consent_app (application_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS application_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  application_id INT NULL,
  candidate_id INT NULL,
  kind VARCHAR(40) NOT NULL DEFAULT 'cv',
  file_name VARCHAR(255) NULL, file_type VARCHAR(100) NULL, file_size INT NULL,
  storage_key VARCHAR(500) NULL,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appfile_app (application_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS interviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  application_id INT NOT NULL,
  type ENUM('Phone','Online','In-person','Technical','Final') NOT NULL DEFAULT 'Online',
  interviewers VARCHAR(400) NULL,
  scheduled_at DATETIME NULL,
  location VARCHAR(255) NULL, meeting_link VARCHAR(300) NULL,
  status ENUM('Scheduled','Completed','Cancelled','No Show') NOT NULL DEFAULT 'Scheduled',
  notes TEXT NULL, score TINYINT NULL,
  recommendation ENUM('Proceed','Hold','Reject') NULL,
  attachment_file_id INT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_interview_app (application_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_evaluations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  application_id INT NOT NULL,
  evaluator_id INT NULL,
  overall TINYINT NULL, skills_match TINYINT NULL, experience_match TINYINT NULL,
  communication TINYINT NULL, cultural_fit TINYINT NULL, salary_fit TINYINT NULL, availability TINYINT NULL,
  feedback TEXT NULL,
  recommendation ENUM('Strong Hire','Hire','Neutral','No Hire','Strong No Hire') NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_eval_app (application_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (evaluator_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS application_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  application_id INT NOT NULL,
  user_id INT NULL, user_name VARCHAR(200) NULL,
  event_type VARCHAR(80) NULL, from_stage VARCHAR(40) NULL, to_stage VARCHAR(40) NULL,
  detail TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_appevent_app (application_id, created_at),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
