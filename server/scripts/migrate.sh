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
echo "✅ All migrations applied."
