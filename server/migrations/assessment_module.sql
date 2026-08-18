-- ============================================================================
-- Job Applicant Assessment System. New tables (idempotent).
-- Applied via apply_assessment_module.mjs, registered in scripts/migrate.sh
-- right after apply_recruitment.mjs (this module builds on job_applications
-- and interviews from the recruitment module).
-- ============================================================================

CREATE TABLE IF NOT EXISTS assessment_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  position_title VARCHAR(200) NULL,
  vacancy_id INT NULL,
  status ENUM('Draft','Active','Archived') NOT NULL DEFAULT 'Draft',
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_asstpl_company (company_id),
  INDEX idx_asstpl_vacancy (vacancy_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_template_versions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  version_no INT NOT NULL,
  is_current BOOLEAN NOT NULL DEFAULT FALSE,
  change_note TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tplver (template_id, version_no),
  INDEX idx_tplver_current (template_id, is_current),
  FOREIGN KEY (template_id) REFERENCES assessment_templates(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_stages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_version_id INT NOT NULL,
  stage_order TINYINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  duration_minutes SMALLINT NOT NULL DEFAULT 20,
  max_score SMALLINT NOT NULL DEFAULT 100,
  passing_score SMALLINT NOT NULL DEFAULT 60,
  UNIQUE KEY uq_stage_order (template_version_id, stage_order),
  FOREIGN KEY (template_version_id) REFERENCES assessment_template_versions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_questions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  stage_id INT NOT NULL,
  question_order TINYINT NOT NULL,
  type ENUM('multiple_choice','short_answer','open_ended','scenario') NOT NULL,
  question_text TEXT NOT NULL,
  options JSON NULL,
  correct_option_key VARCHAR(5) NULL,
  expected_answer TEXT NULL,
  ai_eval_instructions TEXT NULL,
  weight SMALLINT NOT NULL DEFAULT 10,
  consistency_pair_question_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_q_order (stage_id, question_order),
  INDEX idx_q_pair (consistency_pair_question_id),
  FOREIGN KEY (stage_id) REFERENCES assessment_stages(id) ON DELETE CASCADE,
  FOREIGN KEY (consistency_pair_question_id) REFERENCES assessment_questions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  application_id INT NOT NULL,
  template_version_id INT NOT NULL,
  token VARCHAR(64) NOT NULL,
  status ENUM('Pending','InProgress','Paused','Stopped','Completed') NOT NULL DEFAULT 'Pending',
  current_stage TINYINT NOT NULL DEFAULT 1,
  stage1_score DECIMAL(5,2) NULL,
  stage2_score DECIMAL(5,2) NULL,
  stage3_score DECIMAL(5,2) NULL,
  overall_score DECIMAL(6,2) NULL,
  final_status ENUM('Passed','HR Review Required','Failed','Assessment Completed') NULL,
  consistency_flag BOOLEAN NOT NULL DEFAULT FALSE,
  consistency_note TEXT NULL,
  stage_started_at DATETIME NULL,
  stage_deadline_at DATETIME NULL,
  started_at DATETIME NULL,
  completed_at DATETIME NULL,
  paused_at DATETIME NULL,
  stopped_reason TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_sess_token (token),
  INDEX idx_sess_app (application_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (application_id) REFERENCES job_applications(id) ON DELETE CASCADE,
  FOREIGN KEY (template_version_id) REFERENCES assessment_template_versions(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  session_id INT NOT NULL,
  question_id INT NOT NULL,
  answer_text TEXT NULL,
  selected_option_key VARCHAR(5) NULL,
  autosaved_at DATETIME NULL,
  submitted_at DATETIME NULL,
  ai_score DECIMAL(5,2) NULL,
  ai_confidence DECIMAL(3,2) NULL,
  ai_evaluation TEXT NULL,
  ai_flagged_review BOOLEAN NOT NULL DEFAULT FALSE,
  hr_override_score DECIMAL(5,2) NULL,
  hr_note TEXT NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  UNIQUE KEY uq_answer (session_id, question_id),
  INDEX idx_answer_question (question_id),
  FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (question_id) REFERENCES assessment_questions(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_session_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  company_id INT NOT NULL,
  session_id INT NOT NULL,
  user_id INT NULL,
  user_name VARCHAR(200) NULL,
  event_type VARCHAR(80) NOT NULL,
  detail TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_asevent_session (session_id, created_at),
  FOREIGN KEY (session_id) REFERENCES assessment_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
