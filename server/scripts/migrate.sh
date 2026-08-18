#!/bin/sh
# Apply all database migrations in order. Idempotent — safe to re-run.
# Run from the server directory:  sh scripts/migrate.sh
# (For a brand-new database, first load schema.sql, then run this.)
set -e
cd "$(dirname "$0")/.."

echo "Running IST HR migrations…"
node apply_phase1.mjs
node apply_phase2.mjs
node apply_leave.mjs
node apply_attendance.mjs
node apply_payroll.mjs
node apply_onboarding_v2.mjs
node apply_notifications.mjs
node apply_recruitment.mjs
node apply_letterheads.mjs
node apply_attendance_id.mjs
node apply_salary_reviews.mjs
node apply_onboarding_checklist_templates.mjs
node apply_application_source.mjs
node apply_labour_contract_status.mjs
node apply_company_email_domains.mjs
node apply_employee_photo.mjs
node apply_leave_docs.mjs
node apply_employee_bank.mjs
node apply_wps_fields.mjs
node apply_asset_ownership.mjs
node apply_secret_tiers.mjs
node apply_inventory_lifecycle.mjs
node apply_digital_access.mjs
node apply_social_governance.mjs
node apply_domain_assets.mjs
node apply_candidate_created_by.mjs
node apply_envelope_encryption.mjs
node apply_document_expiry.mjs
node apply_accountant_role.mjs
node apply_fix_user_company_mismatch.mjs
node apply_attendance_drive_sync.mjs
node apply_work_schedules.mjs
node apply_fix_employee_company_scope.mjs
node apply_attendance_evaluation.mjs
node apply_seed_uae_holidays_2026.mjs
node apply_backfill_employee_end_date.mjs
node apply_monfri_schedule.mjs
node apply_exception_leave_link.mjs
node apply_leave_policy.mjs
node apply_remap_legacy_leave.mjs
node seed_asset_catalog.mjs
node seed_social_accounts.mjs
node apply_assessment_module.mjs
node seed_assessment_bdmanager.mjs
node apply_assessment_confirm.mjs
echo "✅ All migrations applied."
