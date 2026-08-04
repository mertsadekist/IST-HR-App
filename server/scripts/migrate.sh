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
node seed_asset_catalog.mjs
node seed_social_accounts.mjs
echo "✅ All migrations applied."
