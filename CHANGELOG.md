# Changelog

All notable changes to the IST HR System. Dates are ISO (YYYY‑MM‑DD). The app version is shown in the sidebar footer and in `client/package.json` / `server/package.json`.

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
