# Changelog

All notable changes to the IST HR System. Dates are ISO (YYYY‑MM‑DD). The app version is shown in the sidebar footer and in `client/package.json` / `server/package.json`.

---

## [Unreleased]

### Changed
- **Attendance now syncs live from Hik Central** (PostgreSQL, read‑only) instead of the daily Google Drive CSV. First door punch of the day = check‑in, last = check‑out; a live pass every few minutes keeps today current and a daily close records absences and approved leave. See `docs/attendance_hik_sync.md`.
- Attendance → *Hik Central Sync* page replaces *Drive Sync* (test connection, table discovery, sync now, close days, admin backfill, unmatched person IDs).

### Removed
- Google Drive attendance sync, its CSV parser, `GOOGLE_DRIVE_SA_*` / `ATTENDANCE_DRIVE_FOLDER_ID` variables and the `google-auth-library` dependency. Existing `Drive Sync` attendance rows and the `attendance_sync_*` ledger tables are kept as history.

### Added
- **Loans, salary advances and one-time pay items** (new page *Loans & One-time Items*, `/payroll-items`):
  - **Loans and advances.** Repaid in equal monthly instalments from a chosen start month; the last instalment is whatever is left. Each instalment is recorded against the payroll item that took it (`loan_repayments`), so regenerating or deleting a Draft gives it back. "Repaid" counts only approved and paid runs. A loan is settled automatically when an approved run covers it. Admin and HR manager can close one early as Settled or Cancelled, with a note.
  - **One-time items.** Bonus, commission, one-off allowance, reimbursement, overtime, deduction or other, for a given month. Earnings are paid on top of gross through `payroll_items.additions`, never through the daily rate, and fill the WPS file's *Variable Portion*. Deductions add to the deductions. Each item shows on the payslip under the description HR typed. Items are locked once their run is submitted; a month that is already submitted takes no new items.
  - The salary explanation workbook reconciles leave and absence only, so loans and one-time deductions no longer show as mismatches.
  - Schema at boot through `ensureSchema`: `employee_loans`, `loan_repayments`, `payroll_adjustments`, and `payroll_items.additions`.
- **Payroll v2** (no change to how any figure is calculated):
  - **Payslip lines.** Each payroll item now stores its lines: basic, each allowance, leave deductions by leave type, and absence, with the working (days × daily rate). They add up exactly to gross and deductions. HR sees them by expanding an employee in the run; the employee sees them in My Salary.
  - **Salary breakdown.** A new tab on the employee profile records what the allowances are made of (housing, transport, food, phone, other). It only labels the payslip: `full_salary` stays the contract total, and any difference shows as its own line and as a warning.
  - **Approval workflow.** Draft → Pending Approval → Approved → Paid. Send back returns a run to Draft with a reason, and the submitter is notified. Four eyes: whoever submitted the run cannot approve it; an admin can, but only with a written reason kept on the run.
  - **Blocking checks before submit.** No salary; WPS employees missing a work permit, personal number, IBAN or bank; an invalid UAE IBAN (format + mod-97); company MOL ID missing. An admin can override with a recorded reason.
  - **Warnings.** Net changed by more than 10% against the last approved or paid run, deductions over half of gross, unverified bank, breakdown not matching, new in the run, outside WPS.
  - **Comparison tab** showing each employee's net against the previous approved or paid run, and which lines moved.
  - **Email payslips.** Once approved, each employee gets the existing `payslip_notification` email with their totals.
  - Schema is created at startup by `ensureSchema`: `pay_component_types` (seeded), `employee_pay_components`, `payroll_item_lines`, new `payroll_runs` columns, and the `Pending Approval` status. No manual migration is needed.
- **Document Radar** (`/document-radar`, admin and HR manager): employee passports, residence visas, Emirates IDs and labour cards by expiry date, plus the current employees with no dated record of a document they must hold (UAE nationals are not asked for a residence visa). Employee documents now carry a type, number, issue date and expiry date, set on upload or edited later from the profile's Documents tab. HR is notified 90/60/30/14/7/1 days before expiry, once per threshold, and the dashboard shows a banner when any have expired or expire within 30 days. Migration: `server/apply_employee_document_expiry.mjs`.
- `HIK_*` environment variables, `server/apply_attendance_hik_sync.mjs`, `server/check_hik_sync.mjs` (read‑only connection check / table discovery / preview), and `hik*.sql` in `.gitignore`.

---

## [2.5.0] — 2026‑06‑22

The consolidation release: full bilingual coverage, document/letterhead emailing, the single‑organization model, the in‑app Knowledge Base, and a security/quality hardening pass on top of the v2.0 feature base.

### Added
- **Knowledge Base** in‑app at `/help`: every page documented in EN/AR with **104 real product screenshots** (in `client/public/kb`, served at `/kb/*`), a click‑to‑zoom lightbox, step‑by‑step guides, tips and FAQs; a contextual “?” button deep‑links to the current page’s article.
- **Send documents by email as PDF** with a bilingual cover note across legal letters, employment offers, handover receipts and reports; recorded in the Email Log.
- **Per‑company A4 letterheads** uploaded in Settings → Companies (admin), composed behind generated PDFs with per‑company millimetre margins; applied to Print/Download/Email.
- **In‑app i18n audit gate** (`npm run i18n:check`) enforcing key parity, no missing keys, and zero hardcoded toasts.
- Project documentation: `README.md`, `DESIGN.md`, `SECURITY.md`, `CLAUDE.md`, `MEMORY.md`, this `CHANGELOG.md`.

### Changed
- **Single‑organization, multi‑company model.** Internal staff (`admin`, `hr_manager`, `recruiter`) see all companies and narrow to a selected Entity; `employee` is pinned. Role governs permissions, Entity governs data scope (`server/middleware/tenant.js`).
- **`hr_manager` role finalized:** full HR access, **no deletes**, **companies view‑only**, no user management — enforced via route guards, scoping, and hidden delete buttons in the UI (15+ pages).
- Full EN/AR translation with RTL; browser tab title set to “IST HR System”.
- **Bundle splitting** in `vite.config.js` (`manualChunks` for react/redux/charts/i18n/icons; PDF libs kept lazy) — entry chunk ~265KB, no chunk‑size warning.
- Isolation/scoping **tests rewritten** to the single‑org model.

### Fixed
- SMTP “wrong version number” (TLS mode now derived from port: 465 implicit, 587 STARTTLS) and “Missing credentials” (frontend field name aligned to `smtp_password`).
- Asset/CORS 503 over HTTP (removed forced `upgrade-insecure-requests`, added `trust proxy`).
- Legal letters issued under the company selected on the form (not the employee’s); letterhead applied reliably by carrying letterhead fields on the letter row.
- User‑management 404s (added `GET /users/:id`, `PUT /users/:id/password`; scoped by admin authority, not the Entity selector).
- Removed default admin credentials from the Knowledge Base.

### Security
- Secrets rotated and moved to **runtime‑only** (Coolify); `.env` gitignored.
- AES‑256‑GCM (`ENCRYPTION_KEY`, distinct from `JWT_SECRET`) for stored account passwords; Helmet, rate limiting, email header‑injection guards, per‑request company scoping (IDOR‑safe), full audit log.

---

## [2.0.0] — baseline

Core HRMS feature set prior to the v2.5 consolidation:

- Recruitment: ATS pipeline, candidates, vacancies, public Careers page, applicants, AI CV scorer.
- Employee lifecycle: employee directory + guided add‑employee wizard, stage‑gated onboarding (v2), leave, attendance, payroll runs, assets, inventory, performance, offboarding, handover sheet.
- Compliance: legal letters, company documents, UAE Payroll & Labor Law calculators (EOSB per Federal Decree‑Law No. 33 of 2021).
- Analytics: dashboard, reports, KPI tracker, audit log, email log, org chart.
- Operations/Settings: users, companies, departments & titles, skills, asset catalog, system config, email (SMTP), templates.
- Portal: My Assets & Accounts.
- Foundations: JWT auth, RBAC, validation layer, MySQL schema + idempotent migrations, DeepSeek AI integration, notifications, single‑image Docker deploy on Coolify.

---

_Format inspired by [Keep a Changelog](https://keepachangelog.com/). Versioning is pragmatic semver._
