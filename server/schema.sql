-- IST HR System — Full Database Schema
-- Run against MySQL: mysql -h 147.93.27.94 -P 5458 -u mysql -p default < schema.sql

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================
-- 1. COMPANIES
-- ============================================
CREATE TABLE IF NOT EXISTS companies (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    short_code      VARCHAR(10) NOT NULL UNIQUE,
    logo            LONGTEXT NULL,
    address         TEXT NULL,
    phone           VARCHAR(50) NULL,
    email           VARCHAR(255) NULL,
    website         VARCHAR(255) NULL,
    -- Official mail domains owned by this company, comma-separated. Drives the
    -- employee email builder (company domain vs public provider).
    email_domains   VARCHAR(500) NULL,
    currency        VARCHAR(10) NOT NULL DEFAULT 'AED',
    industry        VARCHAR(100) NULL,
    crm_platform    VARCHAR(100) NULL,
    color_primary   VARCHAR(20) DEFAULT '#6D28D9',
    color_secondary VARCHAR(20) DEFAULT '#1D1245',
    status          ENUM('Active', 'Inactive') DEFAULT 'Active',
    salary_review_approver_id INT NULL,        -- designated approver for salary reviews (users.id)
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (salary_review_approver_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. USERS
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    username        VARCHAR(100) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    email           VARCHAR(255) NULL,
    role            ENUM('admin', 'hr_manager', 'recruiter', 'employee') DEFAULT 'employee',
    company_id      INT NULL,
    is_active       BOOLEAN DEFAULT TRUE,
    last_login_at   TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. DEPARTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS departments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    company_id      INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    description     TEXT NULL,
    head_count_limit INT NULL,
    parent_dept_id  INT NULL,
    icon            VARCHAR(10) DEFAULT '📁',
    sort_order      INT DEFAULT 0,
    status          ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_dept_id) REFERENCES departments(id) ON DELETE SET NULL,
    UNIQUE KEY uq_dept_company (company_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. JOB TITLES
-- ============================================
CREATE TABLE IF NOT EXISTS job_titles (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    department_id   INT NOT NULL,
    company_id      INT NOT NULL,
    title           VARCHAR(255) NOT NULL,
    description     TEXT NULL,
    status          ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS job_title_seniorities (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    job_title_id    INT NOT NULL,
    level           VARCHAR(50) NOT NULL,
    salary_min      DECIMAL(12, 2) NULL,
    salary_max      DECIMAL(12, 2) NULL,
    FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. SKILLS
-- ============================================
CREATE TABLE IF NOT EXISTS skill_categories (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    icon            VARCHAR(10) DEFAULT '🎯',
    color           VARCHAR(20) DEFAULT '#6D28D9',
    sort_order      INT DEFAULT 0,
    status          ENUM('Active', 'Archived') DEFAULT 'Active',
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skills (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    category_id     INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    status          ENUM('Active', 'Archived') DEFAULT 'Active',
    FOREIGN KEY (category_id) REFERENCES skill_categories(id) ON DELETE CASCADE,
    UNIQUE KEY uq_skill_name (category_id, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS job_title_skills (
    job_title_id    INT NOT NULL,
    skill_id        INT NOT NULL,
    is_required     BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (job_title_id, skill_id),
    FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. ATS STAGES
-- ============================================
CREATE TABLE IF NOT EXISTS ats_stages (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,
    color           VARCHAR(20) DEFAULT '#EDE9FE',
    text_color      VARCHAR(20) DEFAULT '#5B21B6',
    sort_order      INT NOT NULL,
    is_success      BOOLEAN DEFAULT FALSE,
    is_fail         BOOLEAN DEFAULT FALSE,
    is_default      BOOLEAN DEFAULT FALSE,
    status          ENUM('Active', 'Inactive') DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 7. VACANCIES
-- ============================================
CREATE TABLE IF NOT EXISTS vacancies (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    company_id      INT NOT NULL,
    department_id   INT NULL,
    job_title_id    INT NULL,
    head_count      INT DEFAULT 1,
    status          ENUM('Draft', 'Open', 'On Hold', 'Closed') DEFAULT 'Draft',
    description     TEXT NULL,
    requirements    TEXT NULL,
    created_by      INT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    closed_at       TIMESTAMP NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 8. CANDIDATES
-- ============================================
CREATE TABLE IF NOT EXISTS candidates (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NULL,
    phone           VARCHAR(50) NULL,
    nationality     VARCHAR(100) NULL,
    score           TINYINT DEFAULT 0,
    vacancy_id      INT NULL,
    company_id      INT NOT NULL,
    current_stage_id INT NULL,
    notes           TEXT NULL,
    applied_date    DATE NULL,
    status          ENUM('Active', 'Hired', 'Failed', 'Blacklisted') DEFAULT 'Active',
    cv_text         LONGTEXT NULL,
    cv_file_name    VARCHAR(255) NULL,
    ai_score        DECIMAL(5, 2) NULL,
    ai_analysis     JSON NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (current_stage_id) REFERENCES ats_stages(id) ON DELETE SET NULL,
    UNIQUE KEY uq_cand_company_email (company_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_skills (
    candidate_id    INT NOT NULL,
    skill_id        INT NOT NULL,
    proficiency     ENUM('Beginner', 'Intermediate', 'Advanced', 'Expert') DEFAULT 'Intermediate',
    PRIMARY KEY (candidate_id, skill_id),
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_stage_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id    INT NOT NULL,
    stage_id        INT NOT NULL,
    moved_by        INT NULL,
    notes           TEXT NULL,
    moved_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES ats_stages(id) ON DELETE CASCADE,
    FOREIGN KEY (moved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS candidate_documents (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id    INT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(100) NULL,
    file_size       INT NULL,
    file_data       LONGBLOB NULL,
    doc_type        ENUM('CV', 'ID', 'Certificate', 'Other') DEFAULT 'CV',
    uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 9. EMPLOYEES
-- ============================================
CREATE TABLE IF NOT EXISTS employees (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id    INT NULL,
    first_name      VARCHAR(100) NOT NULL,
    last_name       VARCHAR(100) NOT NULL,
    email           VARCHAR(255) NULL,
    phone           VARCHAR(50) NULL,
    nationality     VARCHAR(100) NULL,
    company_id      INT NOT NULL,
    department_id   INT NULL,
    job_title_id    INT NULL,
    job_title_text  VARCHAR(255) NULL,
    start_date      DATE NULL,
    end_date        DATE NULL,
    basic_salary    DECIMAL(12, 2) NULL,
    full_salary     DECIMAL(12, 2) NULL,
    attendance_id   VARCHAR(100) NULL,
    status          ENUM('Onboarding', 'Active', 'Offboarding', 'Exited') DEFAULT 'Onboarding',
    -- Has the UAE labour contract / work residency actually been issued?
    -- 'Not Issued' = still probationary/trial (a legal notice is shown in the UI).
    labour_contract_status    ENUM('Not Issued', 'Issued') NOT NULL DEFAULT 'Not Issued',
    labour_contract_issued_at DATE NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE SET NULL,
    UNIQUE KEY uq_emp_company_email (company_id, email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Global key/value app settings (e.g. timezone)
CREATE TABLE IF NOT EXISTS app_settings (
    k           VARCHAR(100) PRIMARY KEY,
    v           TEXT NULL,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 9b. ANNUAL SALARY REVIEW
-- ============================================
-- One review CYCLE per company per year (the "batch" HR prepares).
CREATE TABLE IF NOT EXISTS salary_reviews (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per employee inside a review cycle — the actual raise proposal.
CREATE TABLE IF NOT EXISTS salary_review_items (
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
    band_min              DECIMAL(12, 2) NULL,   -- job_title_seniorities envelope, snapshotted at prep time
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Per-employee UAE compliance checklist (contract amendment, MOHRE, WPS, custom).
CREATE TABLE IF NOT EXISTS salary_review_actions (
    id                     INT AUTO_INCREMENT PRIMARY KEY,
    salary_review_item_id  INT NOT NULL,
    action_key             VARCHAR(50) NOT NULL,   -- 'contract_amendment' | 'mohre_update' | 'wps_update' | 'custom'
    custom_label           VARCHAR(255) NULL,
    is_required             BOOLEAN DEFAULT TRUE,
    status                 ENUM('Pending', 'Completed', 'Skipped') DEFAULT 'Pending',
    completed_by           INT NULL,
    completed_at           TIMESTAMP NULL,
    notes                  VARCHAR(500) NULL,
    sort_order             INT DEFAULT 0,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (salary_review_item_id) REFERENCES salary_review_items(id) ON DELETE CASCADE,
    FOREIGN KEY (completed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_action_item (salary_review_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Uploaded proof documents (revision letter, signed contract, MOHRE/WPS proof).
CREATE TABLE IF NOT EXISTS salary_review_documents (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 10. ONBOARDING
-- ============================================
CREATE TABLE IF NOT EXISTS onboarding_records (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NULL,                            -- onboarding may precede employee creation (v2)
    company_id      INT NOT NULL,
    status          ENUM('In Progress', 'Completed', 'Cancelled') DEFAULT 'In Progress',
    -- v2 stage machine (see docs/modules/onboarding_v2_redesign.md)
    stage           ENUM('DRAFT','CV_UPLOADED','UNDER_HR_REVIEW','HR_APPROVED','OFFER_SENT',
                         'OFFER_ACCEPTED','SIGNED_OFFER_UPLOADED','DOCUMENTS_COLLECTION','VISA_RESIDENCY',
                         'BANK_DETAILS','READY_FOR_EMPLOYMENT','COMPLETED','REJECTED','CANCELLED')
                         NOT NULL DEFAULT 'DRAFT',
    candidate_id    INT NULL,
    vacancy_id      INT NULL,
    offer_state     ENUM('none','sent','accepted','rejected') NOT NULL DEFAULT 'none',
    rejection_reason TEXT NULL,
    assigned_to     INT NULL,
    created_by      INT NULL,
    started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMP NULL,
    INDEX idx_onb_stage (company_id, stage),
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_steps (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    onboarding_id   INT NOT NULL,
    step_number     INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    owner           VARCHAR(100) NULL,
    sla             VARCHAR(100) NULL,
    status          ENUM('Locked', 'Open', 'Complete') DEFAULT 'Locked',
    notes           TEXT NULL,
    opened_at       TIMESTAMP NULL,
    completed_at    TIMESTAMP NULL,
    FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_checklist_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    step_id         INT NOT NULL,
    label           VARCHAR(500) NOT NULL,
    is_checked      BOOLEAN DEFAULT FALSE,
    sort_order      INT DEFAULT 0,
    checked_at      TIMESTAMP NULL,
    FOREIGN KEY (step_id) REFERENCES onboarding_steps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_step_templates (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    company_id      INT NOT NULL,
    step_number     INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    owner           VARCHAR(100) NULL,
    sla             VARCHAR(100) NULL,
    sort_order      INT DEFAULT 0,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS onboarding_step_template_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    template_step_id INT NOT NULL,
    label           VARCHAR(500) NOT NULL,
    sort_order      INT DEFAULT 0,
    FOREIGN KEY (template_step_id) REFERENCES onboarding_step_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 11. ASSETS
-- ============================================
CREATE TABLE IF NOT EXISTS asset_categories (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    icon            VARCHAR(10) DEFAULT '💻',
    color           VARCHAR(20) DEFAULT '#374151',
    sort_order      INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_catalog (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    category_id     INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    asset_type      ENUM('Hardware', 'Account', 'Software') DEFAULT 'Account',
    description     TEXT NULL,
    inventory_total INT DEFAULT 0,
    status          ENUM('Active', 'Inactive') DEFAULT 'Active',
    FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_companies (
    platform_id     INT NOT NULL,
    company_id      INT NOT NULL,
    PRIMARY KEY (platform_id, company_id),
    FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS asset_assignments (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    platform_id     INT NULL,
    company_id      INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    asset_type      ENUM('Hardware', 'Account', 'Software') DEFAULT 'Account',
    workspace       VARCHAR(255) NULL,
    access_level    VARCHAR(100) NULL,
    identifier      VARCHAR(255) NULL,
    issued_date     DATE NULL,
    expected_return DATE NULL,
    returned_date   DATE NULL,
    status          ENUM('Active', 'Returned', 'Deactivated', 'Missing') DEFAULT 'Active',
    condition_note  VARCHAR(100) NULL,
    notes           TEXT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 12. PERFORMANCE
-- ============================================
CREATE TABLE IF NOT EXISTS performance_targets (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    company_id      INT NOT NULL,
    quarter         VARCHAR(10) NOT NULL,
    target_amount   DECIMAL(12, 2) NULL,
    currency        VARCHAR(10) DEFAULT 'AED',
    kpi_notes       TEXT NULL,
    status          ENUM('Active', 'Inactive') DEFAULT 'Active',
    signed_at       TIMESTAMP NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 13. OFFBOARDING
-- ============================================
CREATE TABLE IF NOT EXISTS offboarding_records (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_id     INT NOT NULL,
    company_id      INT NOT NULL,
    departure_type  ENUM('Resignation', 'Termination', 'End of Contract', 'Mutual Agreement') NOT NULL,
    last_working_day DATE NOT NULL,
    reason          TEXT NULL,
    basic_salary    DECIMAL(12, 2) NULL,
    full_salary     DECIMAL(12, 2) NULL,
    employment_start DATE NULL,
    eosb_amount     DECIMAL(12, 2) NULL,
    leave_encashment DECIMAL(12, 2) NULL,
    deductions      DECIMAL(12, 2) DEFAULT 0,
    total_settlement DECIMAL(12, 2) NULL,
    status          ENUM('In Progress', 'Completed', 'Cancelled') DEFAULT 'In Progress',
    started_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at    TIMESTAMP NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS offboarding_steps (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    offboarding_id  INT NOT NULL,
    step_number     INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    owner           VARCHAR(100) NULL,
    sla             VARCHAR(100) NULL,
    status          ENUM('Locked', 'Open', 'Complete') DEFAULT 'Locked',
    notes           TEXT NULL,
    opened_at       TIMESTAMP NULL,
    completed_at    TIMESTAMP NULL,
    FOREIGN KEY (offboarding_id) REFERENCES offboarding_records(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS offboarding_checklist_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    step_id         INT NOT NULL,
    label           VARCHAR(500) NOT NULL,
    is_checked      BOOLEAN DEFAULT FALSE,
    sort_order      INT DEFAULT 0,
    checked_at      TIMESTAMP NULL,
    FOREIGN KEY (step_id) REFERENCES offboarding_steps(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS offboarding_step_templates (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    company_id      INT NOT NULL,
    departure_type  VARCHAR(50) NULL,
    step_number     INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    owner           VARCHAR(100) NULL,
    sla             VARCHAR(100) NULL,
    sort_order      INT DEFAULT 0,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS offboarding_step_template_items (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    template_step_id INT NOT NULL,
    label           VARCHAR(500) NOT NULL,
    sort_order      INT DEFAULT 0,
    FOREIGN KEY (template_step_id) REFERENCES offboarding_step_templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 14. LEGAL
-- ============================================
CREATE TABLE IF NOT EXISTS letter_templates (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    type            VARCHAR(50) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    icon            VARCHAR(10) DEFAULT '📄',
    fields_config   JSON NOT NULL,
    body_template   LONGTEXT NOT NULL,
    sort_order      INT DEFAULT 0,
    status          ENUM('Active', 'Inactive') DEFAULT 'Active'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS generated_letters (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    template_id     INT NULL,
    company_id      INT NOT NULL,
    letter_type     VARCHAR(50) NOT NULL,
    recipient_name  VARCHAR(255) NOT NULL,
    field_values    JSON NOT NULL,
    rendered_html   LONGTEXT NULL,
    generated_by    INT NULL,
    generated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES letter_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doc_categories (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    icon            VARCHAR(10) DEFAULT '📁',
    color           VARCHAR(20) DEFAULT '#374151',
    bg_color        VARCHAR(20) DEFAULT '#F1F5F9',
    sort_order      INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS company_documents (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    company_id      INT NOT NULL,
    category        VARCHAR(100) NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_type       VARCHAR(100) NULL,
    file_size       INT NULL,
    file_data       LONGBLOB NULL,
    uploaded_by     INT NULL,
    uploaded_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 15. KPI
-- ============================================
CREATE TABLE IF NOT EXISTS kpi_tiers (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    label           VARCHAR(255) NOT NULL,
    amount          DECIMAL(10, 2) NOT NULL,
    currency        VARCHAR(10) DEFAULT 'AED',
    icon            VARCHAR(10) DEFAULT '🏅',
    criteria        TEXT NULL,
    sort_order      INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kpi_targets (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    target_value    DECIMAL(10, 2) NOT NULL,
    unit            VARCHAR(50) NOT NULL,
    sort_order      INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kpi_hires (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    employee_name   VARCHAR(255) NOT NULL,
    role            VARCHAR(255) NULL,
    company_id      INT NOT NULL,
    join_date       DATE NOT NULL,
    commission      DECIMAL(10, 2) DEFAULT 0,
    status          ENUM('Pending', 'Confirmed') DEFAULT 'Pending',
    notes           TEXT NULL,
    created_by      INT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS kpi_hire_tiers (
    kpi_hire_id     INT NOT NULL,
    kpi_tier_id     INT NOT NULL,
    PRIMARY KEY (kpi_hire_id, kpi_tier_id),
    FOREIGN KEY (kpi_hire_id) REFERENCES kpi_hires(id) ON DELETE CASCADE,
    FOREIGN KEY (kpi_tier_id) REFERENCES kpi_tiers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 16. AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NULL,
    company_id      INT NULL,
    user_name       VARCHAR(255) NOT NULL,
    module          VARCHAR(100) NOT NULL,
    action          VARCHAR(100) NOT NULL,
    detail          TEXT NULL,
    ip_address      VARCHAR(50) NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_company (company_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 17. CV SCORER
-- ============================================
CREATE TABLE IF NOT EXISTS cv_scorer_profiles (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    company_id      INT NULL,
    department      VARCHAR(255) NULL,
    location        VARCHAR(255) NULL,
    employment_type VARCHAR(100) NULL,
    seniority       VARCHAR(100) NULL,
    reports_to      VARCHAR(255) NULL,
    salary_range    VARCHAR(100) NULL,
    min_years_exp   INT DEFAULT 0,
    must_have_skills JSON NULL,
    nice_have_skills JSON NULL,
    required_tools  JSON NULL,
    required_languages JSON NULL,
    required_industries JSON NULL,
    keywords        JSON NULL,
    education_level VARCHAR(50) NULL,
    weights         JSON NULL,
    created_by      INT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_candidates_company ON candidates(company_id);
CREATE INDEX idx_candidates_vacancy ON candidates(vacancy_id);
CREATE INDEX idx_candidates_stage ON candidates(current_stage_id);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_employees_company ON employees(company_id);
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_dept ON employees(department_id);
CREATE INDEX idx_vacancies_company ON vacancies(company_id);
CREATE INDEX idx_vacancies_status ON vacancies(status);
CREATE INDEX idx_assets_employee ON asset_assignments(employee_id);
CREATE INDEX idx_assets_status ON asset_assignments(status);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_module ON audit_logs(module);
CREATE INDEX idx_audit_created ON audit_logs(created_at);
CREATE INDEX idx_docs_company_cat ON company_documents(company_id, category);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================
-- SEED DATA
-- ============================================

-- Default ATS stages
INSERT INTO ats_stages (name, color, text_color, sort_order, is_default, is_success, is_fail) VALUES
('New Applicants',      '#EDE9FE', '#5B21B6', 1,  TRUE,  FALSE, FALSE),
('Shortlisted',         '#DBEAFE', '#1E40AF', 2,  FALSE, FALSE, FALSE),
('Contacted',           '#D1FAE5', '#065F46', 3,  FALSE, FALSE, FALSE),
('Scheduled Interview', '#FEF3C7', '#92400E', 4,  FALSE, FALSE, FALSE),
('1st Interview',       '#FECACA', '#991B1B', 5,  FALSE, FALSE, FALSE),
('2nd Interview',       '#FED7AA', '#9A3412', 6,  FALSE, FALSE, FALSE),
('Assessment',          '#E0E7FF', '#3730A3', 7,  FALSE, FALSE, FALSE),
('Offer Made',          '#CFFAFE', '#155E75', 8,  FALSE, FALSE, FALSE),
('Offer Accepted',      '#ECFDF5', '#047857', 9,  FALSE, FALSE, FALSE),
('Joining Process',     '#FEF9C3', '#854D0E', 10, FALSE, FALSE, FALSE),
('Success',             '#BBF7D0', '#166534', 11, FALSE, TRUE,  FALSE),
('Failed',              '#FECACA', '#991B1B', 12, FALSE, FALSE, TRUE),
('Blacklisted',         '#374151', '#F9FAFB', 13, FALSE, FALSE, TRUE);

-- ============================================
-- 22. NOTIFICATIONS (audit F-08)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    company_id  INT NULL,
    user_id     INT NOT NULL,
    type        VARCHAR(60) NOT NULL DEFAULT 'info',
    title       VARCHAR(200) NOT NULL,
    body        VARCHAR(800) NULL,
    link        VARCHAR(300) NULL,
    is_read     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_notif_user (user_id, is_read, created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin user is created by setup-db.js with a randomly generated initial password
-- (or ADMIN_INITIAL_PASSWORD from the environment). Do NOT seed a known-password
-- admin here — that would ship a default credential. See audit SEC-003.

-- ============================================
-- 18. LEAVE MANAGEMENT (audit F-02)
-- ============================================
CREATE TABLE IF NOT EXISTS leave_types (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NULL,
    name          VARCHAR(100) NOT NULL,
    default_days  DECIMAL(6,2) NOT NULL DEFAULT 0,
    is_paid       BOOLEAN NOT NULL DEFAULT TRUE,
    color         VARCHAR(20) NULL,
    status        ENUM('Active','Inactive') NOT NULL DEFAULT 'Active',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_leave_types_company (company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leave_balances (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NOT NULL,
    employee_id   INT NOT NULL,
    leave_type_id INT NOT NULL,
    year          INT NOT NULL,
    entitled      DECIMAL(6,2) NOT NULL DEFAULT 0,
    used          DECIMAL(6,2) NOT NULL DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_balance (employee_id, leave_type_id, year),
    INDEX idx_balance_company (company_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leave_requests (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NOT NULL,
    employee_id   INT NOT NULL,
    leave_type_id INT NOT NULL,
    start_date    DATE NOT NULL,
    end_date      DATE NOT NULL,
    days          DECIMAL(6,2) NOT NULL,
    reason        TEXT NULL,
    status        ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
    decided_by    INT NULL,
    decided_at    TIMESTAMP NULL,
    decision_note TEXT NULL,
    created_by    INT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_leave_req_company_status (company_id, status),
    INDEX idx_leave_req_employee (employee_id),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE,
    FOREIGN KEY (decided_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 19. ATTENDANCE (audit F-01)
-- ============================================
CREATE TABLE IF NOT EXISTS attendance (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    company_id    INT NOT NULL,
    employee_id   INT NOT NULL,
    work_date     DATE NOT NULL,
    check_in      DATETIME NULL,
    check_out     DATETIME NULL,
    work_hours    DECIMAL(5,2) NULL,
    status        ENUM('Present','Absent','Late','Half Day','On Leave','Holiday','Remote')
                    NOT NULL DEFAULT 'Present',
    notes         VARCHAR(500) NULL,
    created_by    INT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_attendance_emp_date (employee_id, work_date),
    INDEX idx_attendance_company_date (company_id, work_date),
    INDEX idx_attendance_status (status),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 20. PAYROLL (audit F-03)
-- ============================================
CREATE TABLE IF NOT EXISTS payroll_runs (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    company_id       INT NOT NULL,
    period           VARCHAR(7) NOT NULL,
    status           ENUM('Draft','Approved','Paid','Cancelled') NOT NULL DEFAULT 'Draft',
    employee_count   INT NOT NULL DEFAULT 0,
    total_gross      DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_deductions DECIMAL(14,2) NOT NULL DEFAULT 0,
    total_net        DECIMAL(14,2) NOT NULL DEFAULT 0,
    created_by       INT NULL,
    approved_by      INT NULL,
    approved_at      TIMESTAMP NULL,
    paid_at          TIMESTAMP NULL,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_run_company_period (company_id, period),
    INDEX idx_run_company_status (company_id, status),
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payroll_items (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    run_id             INT NOT NULL,
    company_id         INT NOT NULL,
    employee_id        INT NOT NULL,
    basic_salary       DECIMAL(12,2) NOT NULL DEFAULT 0,
    allowances         DECIMAL(12,2) NOT NULL DEFAULT 0,
    gross              DECIMAL(12,2) NOT NULL DEFAULT 0,
    unpaid_leave_days  DECIMAL(6,2) NOT NULL DEFAULT 0,
    absence_days       DECIMAL(6,2) NOT NULL DEFAULT 0,
    deductions         DECIMAL(12,2) NOT NULL DEFAULT 0,
    net                DECIMAL(12,2) NOT NULL DEFAULT 0,
    notes              VARCHAR(500) NULL,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_item_run (run_id),
    INDEX idx_item_employee (employee_id),
    INDEX idx_item_company (company_id),
    FOREIGN KEY (run_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
-- ============================================
-- 21. ONBOARDING v2 (stage workflow) — see docs/modules/onboarding_v2_redesign.md
-- ============================================
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

-- ============================================
-- 23. RECRUITMENT / ATS (see docs/modules/recruitment_landing_redesign.md)
-- Note: vacancies also gains public_slug + rich fields via apply_recruitment.mjs
-- ============================================
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
  -- Self-reported "How did you hear about us?" from the public careers form.
  heard_about_us VARCHAR(60) NULL, referrer_name VARCHAR(200) NULL,
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
