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
- **Leave balances, carry-forward and the approver’s view** (`services/leaveBalanceService.js`, `services/leaveBalanceStore.js`, `routes/leaveBalances.js`):
  - **Balance ledger.** Days on top of the yearly entitlement, each with a reason: opening balances, corrections either way, carried-forward days, lapsed days and encashed days. Remaining = entitlement + ledger − used. Payroll, the payslip explainer, HR's approval check and the final settlement all use the same figure, so carried or opened days are paid when taken, and encashed days are not.
  - **Leave → Balances** now shows what everyone has left of each yearly type, with the ledger underneath. HR can adjust a balance, **import opening balances from CSV** (employee by email, attendance ID or number; checked first, and a re-import replaces rather than adds), and **encash** days. Encashed days are paid at basic / 30 per day as a *Leave encashment* item in a Draft payroll month. An admin can remove a ledger row; an encashment can only be removed while its payroll item is unpaid.
  - **Year end.** Each type has a carry-forward rule (Types tab → settings icon): none (the default for every existing type), up to a limit, or everything, with an optional expiry after N months. *Year end → Carry* moves unused days into the new year; running it again recalculates. *Year end → Lapse* removes carried days not used by their expiry, counting carried days as used first. Both show a preview before applying.
  - **Working-day types.** A type can count working days instead of calendar days. Working days skip each employee's rest days (from their work schedule) and public holidays, with half-day holidays counting half. New requests are counted that way.
  - **New types:** *Study Leave* (10 working days a year after two years of service, Decree-Law 33/2021 art. 32) and *Hajj Leave* (up to 30 days, unpaid, once; company policy). Both are group-wide and added once at startup.
  - **Before sending.** The request form, in the portal and for HR, shows the days counted, how they will be paid (full, half or unpaid, by the type's tiers), the balance before and after, and warnings: not yet eligible, over the per-request maximum, short notice, document needed, over the balance, or overlapping another request. The warnings are advisory and don't block the request. The portal form also takes **part-day leave in hours**.
  - **For the approver.** HR's decision form and *My Approvals* show who else in the team (same manager, else same department) is off over those dates and the busiest day's share. They also show any passport, residence visa or Emirates ID expiring before, during or within 30 days after the leave, and what the request does to pay and balance.
  - **Team calendar.** A month grid of approved and pending leave with public holidays. It appears as the Leave → Calendar tab for HR, and on *My Team* for managers.
  - **Add to calendar.** Approved leave in *My Leave* downloads as an `.ics` file for Outlook or Google Calendar.
  - Schema at boot through `ensureSchema`: `leave_adjustments`; `leave_types.day_basis`, `carry_forward_max`, `carry_forward_expiry_months`; `payroll_adjustments.category` gains *Leave Encashment*.
- **Portal requests** (*My Requests*, `/portal/requests`; HR's *Employee Requests*, `/requests`; `services/employeeRequestService.js`, `routes/requests.js`):
  - **Four kinds.** A **letter** (salary certificate, NOC, employment confirmation, experience certificate, with the language and who it is addressed to), an **expense** to be reimbursed (category, date, amount and receipt), a **salary advance** (amount, months to repay, instalment shown as you type), and an **HR case** (category, subject, description).
  - **Where each one ends.** An approved expense becomes a one-time *Reimbursement* earning in a payroll month (the next one by default; refused if that month's run is past Draft). An approved advance becomes an *Advance* in Loans & advances, deducted by payroll from the month HR chooses, with the instalment HR can adjust. A letter is issued by uploading the signed letter, which the employee downloads from the request. A case gets an owner and a due date, and moves through In progress → Resolved → Closed.
  - **Approval chains.** Expenses and advances can have their own chain (Settings → *Approval chains*) and then appear in the approvers' *My Approvals*. HR's final decision waits for the chain, as for leave and overtime; an admin can decide anyway with a written reason. A rejection in the chain declines the request.
  - **Conversation and files.** Each request has a message thread between the employee and HR and its attachments. Each side is notified when the other writes, and the employee is notified of every decision. Files go to the uploads volume (`employee_requests/`), 10 MB maximum, PDF, image or Word.
  - The employee can withdraw a request until it is decided. HR, finance and admin see the queue for the selected Entity.
  - Schema at boot through `ensureSchema`: `employee_requests`, `employee_request_files`, `employee_request_comments`.
- **Approval chains** (Settings → *Approval chains*; `services/approvalService.js`):
  - **What a chain is.** The steps a leave request or an overtime day goes through *before* HR's final decision: the direct manager, the manager's manager, everyone with a role, or one specific person. There is one chain per process for the whole group, optionally overridden per company. With no chain, nothing changes.
  - **How it runs.** The chain is frozen when a request starts, with its approvers resolved at that moment. A step with nobody to approve it is skipped and says why, and the requester is removed from every step.
  - **Decisions.** A rejection at any step rejects the request. When the chain finishes, HR is notified and makes the final decision exactly as before (documents, balance, attendance re-check, payroll). HR's final approval is refused while the chain is running; an admin can decide anyway with a written reason, recorded on the chain.
  - **My Approvals** (`/portal/approvals`). Whatever is waiting for the signed-in user, with approve or reject (a reason is required to reject). The menu entry appears for managers and anyone with something waiting, with a count.
  - **Notifications.** A whole month of detected overtime sends one notification per approver, not one per day.
  - **Where progress shows:** the chain's steps appear on the Leave page, on Overtime and in My Leave. The leave decision form pre-fills the deciding manager from the chain.
  - **Fix:** leave approve and cancel no longer release their database connection twice on early returns.
  - Schema at boot through `ensureSchema`: `approval_chains`, `approval_requests`, `approval_actions`.
- **Direct manager, people org chart and My Team** (`services/orgService.js`):
  - **Direct manager.** Each employee can have one (`employees.manager_employee_id`), set from the profile under Employment details → Edit. The manager can sit in another company of the group. A choice that would loop (the person themselves, or anyone below them) is refused.
  - **Org chart → By people.** The new default view draws who reports to whom as an expandable tree with search, with direct and total report counts. It also shows how many people still have no manager; they appear at the top level until one is set. The department view is unchanged.
  - **My Team** (`/portal/team`). For anyone with reports, direct or indirect: today's status (in, late, absent, on leave, no punch), the month so far, and pending or approved leave for the next 30 days. Attendance and leave only, never pay, documents or bank details. The menu entry appears only for people who manage someone.
- **Overtime** (new page *Overtime*, `/overtime`; `services/overtimeService.js`):
  - **Detect from attendance** scans a month of door punches against each person's work schedule.
    - On a working day, overtime is time present beyond the scheduled span, from 30 minutes; arriving late offsets staying late.
    - The part after the scheduled end that falls between 22:00 and 04:00 is night overtime.
    - Every minute on a rest day or a full holiday is rest-day overtime.
    - Owners are skipped, today is never judged, and re-running is safe.
  - HR can also add a day manually, with a reason.
  - **Nothing is paid until approved**, and the approver can lower the time. Approved overtime up to the month's end goes into that month's payroll run as one "Overtime" line. Each record remembers the payroll item that paid it; a regenerated or deleted Draft releases it, and a submitted run locks it. A leaver's approved, unpaid overtime goes into the final settlement.
  - **Pay** (Decree-Law 33/2021 art. 19) is on basic: basic/30/8 per hour × 1.25 normal, 1.5 night, 1.5 rest day or holiday. The multipliers are the legal minimums; they can be raised in app settings (`overtime_rates`) but never lowered.
  - Schema at boot through `ensureSchema`: `overtime_records`.
- **Final settlement** (a panel in each offboarding record, `services/settlementService.js`):
  - **What it adds up.** Final salary from the day after the last approved monthly run to the last working day, at gross/30, with a whole calendar month counting as 30 days. Unused annual leave, accrued pro rata in the leaving year, minus leave taken, plus any carry-forward HR confirms; paid on **basic**/30. End-of-service gratuity from the existing engine. One-time items no monthly run paid. Minus outstanding loans and advances. Plus or minus manual lines (notice pay in lieu, notice not served, damages). Every line shows its working.
  - **Never negative.** Deductions beyond the dues are reported as a shortfall to recover separately, not paid as a negative amount.
  - **Draft → Approved → Paid.** Whoever prepared it does not approve it; an admin can, with a reason.
  - **Approval checks.** Unreturned assets or unrevoked access block approval; only an admin can approve anyway, with a reason. Approval is refused while the person is still in an unapproved monthly run, so the same days are not paid twice. The figures are recomputed on approval, and the approver is sent back if anything moved.
  - **Paid is final.** It records the date and the transfer or cheque reference, closes the loans it deducted, and marks the one-time items it paid so no later run picks them up.
  - **Deadline and PDF.** The 14-day legal deadline from the last working day is shown and flagged when overdue. The settlement downloads as a PDF on the company letterhead.
  - Schema at boot through `ensureSchema`: `offboarding_settlement_lines`, the settlement columns on `offboarding_records`, and `payroll_adjustments.settlement_id`.
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
