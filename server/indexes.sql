-- IST HR System — Performance Indexes
-- Run after initial schema to optimize query performance

-- Candidates: Most queried table
CREATE INDEX IF NOT EXISTS idx_candidates_company ON candidates(company_id);
CREATE INDEX IF NOT EXISTS idx_candidates_vacancy ON candidates(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_candidates_stage ON candidates(current_stage_id);
CREATE INDEX IF NOT EXISTS idx_candidates_status ON candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_search ON candidates(first_name, last_name, email);

-- Employees: Frequent lookups
CREATE INDEX IF NOT EXISTS idx_employees_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_employees_dept ON employees(department_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

-- Audit logs: Paginated queries with filters
CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);

-- Vacancies
CREATE INDEX IF NOT EXISTS idx_vacancies_company ON vacancies(company_id);
CREATE INDEX IF NOT EXISTS idx_vacancies_status ON vacancies(status);

-- Onboarding/Offboarding
CREATE INDEX IF NOT EXISTS idx_onboarding_employee ON onboarding_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_company ON onboarding_records(company_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_employee ON offboarding_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_offboarding_company ON offboarding_records(company_id);

-- Assets
CREATE INDEX IF NOT EXISTS idx_assets_employee ON asset_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_assets_status ON asset_assignments(status);

-- Stage history
CREATE INDEX IF NOT EXISTS idx_stage_history_candidate ON candidate_stage_history(candidate_id);

-- KPI
CREATE INDEX IF NOT EXISTS idx_kpi_hires_company ON kpi_hires(company_id);

-- Performance targets
CREATE INDEX IF NOT EXISTS idx_perf_employee ON performance_targets(employee_id);

-- Documents
CREATE INDEX IF NOT EXISTS idx_docs_company ON company_documents(company_id);

-- Departments & Job Titles
CREATE INDEX IF NOT EXISTS idx_departments_company ON departments(company_id);
CREATE INDEX IF NOT EXISTS idx_jobtitles_dept ON job_titles(department_id);
