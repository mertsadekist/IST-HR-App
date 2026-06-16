-- ============================================================================
-- Phase 1 — Critical Security & Data Isolation migration
-- Safe/idempotent where possible. Run once against the target database.
-- See audit/06_BUG_FIXING_PLAN.md Phase 1.
-- ============================================================================

-- TEN-003: tenant dimension on the audit log -------------------------------
ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS company_id INT NULL AFTER user_id;

-- Backfill historical rows from the acting user's company
UPDATE audit_logs a
  JOIN users u ON a.user_id = u.id
  SET a.company_id = u.company_id
  WHERE a.company_id IS NULL;

-- Index for per-tenant audit queries
CREATE INDEX idx_audit_company ON audit_logs (company_id, created_at);

-- DB-001: allow companies to be soft-deleted (block hard cascade wipe) -------
ALTER TABLE companies
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL DEFAULT NULL;

-- DB-006: composite indexes for tenant-scoped filters ------------------------
CREATE INDEX idx_cand_co_status ON candidates (company_id, status);
CREATE INDEX idx_emp_co_status ON employees (company_id, status);
CREATE INDEX idx_onb_co_status ON onboarding_records (company_id, status);
CREATE INDEX idx_off_co_status ON offboarding_records (company_id, status);
CREATE INDEX idx_asg_co_status ON asset_assignments (company_id, status);

-- NOTE: MySQL < 8.0.29 does not support "ADD COLUMN IF NOT EXISTS" or
-- "CREATE INDEX IF NOT EXISTS". If your server rejects those, run the
-- statements once without the guard and ignore "duplicate" errors on re-run.
