# 05 — Workflow & Business Logic Review

**Audit date:** 2026-06-11

This document walks each HR workflow: current flow (as built), problems, missing steps, recommended flow (text diagram), and the database/API/frontend changes required.

Legend in diagrams: `✓` built · `⚠` built but flawed · `✗` missing.

---

## 1. Recruitment / ATS

**Current flow** (`vacancies.js`, `candidates.js`, `cvScorer.js`, `ai.js`):
```
✓ Create vacancy → ✓ Add candidate → ✓ Upload CV (parse+autofill) →
✓ AI score vs profile → ✓ Move through ATS stages (Kanban) →
✓ "Success" stage triggers hire transaction (employee + onboarding) | ✗ rejection reason
```
**Problems:** tenant `company_id` from client (TEN-001); CV→LLM prompt injection (SEC-008); mock work-history/salary shown when AI empty (UI-001); no interviews, no offer step, no rejection reasons; `parse-cv` unauthenticated (SEC-013); no AI rate limiting (SEC-010).

**Missing steps:** shortlist/manager review, interview scheduling + scorecards, offer generation + acceptance, reference/background checks.

**Recommended flow:**
```
Vacancy(approved) → Applications → AI screen(sanitized) → Manager shortlist(approval) →
Interviews(scheduled, scorecards) → Offer(generated, sent, accepted) →
Background check → Hire(transaction) | Reject(reason captured)
```
**DB:** `interviews`, `offers`, `candidates.rejection_reason`, `candidates.company_id` already present. **API:** `/interviews`, `/offers`, scope all by `req.companyId`, auth+limit on `parse-cv`, clamp AI score. **Frontend:** interview/offer UI, remove mock fallbacks, approval inbox hook.

---

## 2. Employee Onboarding

**Current flow** (`onboarding.js`):
```
✓ Hire creates onboarding_record (status In Progress) →
✓ POST /:id/init loads company templates → ✓ steps + checklist items (sequential, first unlocked) →
⚠ toggle checklist items (NO authz) → ⚠ complete step (NO authz, unlocks next) →
✓ final step → record Completed
```
**Problems:** any user can mutate any checklist/step (TEN-007); SLA stored as VARCHAR, never enforced (DB-007, WF-005); no email notifications; no pre-boarding; no document collection or equipment requisition; no `checked_by` (DB-012).

**Recommended flow:**
```
Hire → Pre-boarding(T-minus: welcome email, doc collection) →
Onboarding init(template) → Tasks assigned to owners(notified) →
SLA timers(escalate on breach) → Equipment requisition(→asset module) →
Doc checklist(contract, ID, visa) → Completion → Onboarding survey
```
**DB:** `sla_hours INT`, `onboarding_checklist_items.checked_by`, `onboarding_records` pre-board fields, link to `employee_documents`. **API:** authz + company-ownership on all step/checklist endpoints; SLA breach checker job; notification triggers. **Frontend:** owner assignment UI, SLA/overdue badges, document upload slots.

---

## 3. Offboarding

**Current flow** (`offboarding.js`):
```
✓ Initiate (employee, departure_type, last_working_day, reason) →
⚠ EOSB auto-calc (21/30 day rule, daily=basic/30) →
✓ load templates → steps + checklist (sequential) →
⚠ complete steps (NO authz) → ✓ record Completed; employee status → Offboarding
```
**Problems:** EOSB legally incomplete (WF-001) — ignores <1-year ineligibility/probation, resignation vs termination scales, unpaid-leave deductions, contract type; no settlement breakdown (pending salary, leave encashment, loans, gratuity); clearance steps are manual checkboxes not linked to live asset assignments or account revocation (WF-006); checklist mutation unauthenticated (TEN-007); no final-payslip / NOC integration.

**Recommended flow:**
```
Initiate(approval: manager+HR) → EOSB engine(probation, type, unpaid-leave, breakdown) →
Auto-generate clearance from live state(assets assigned, accounts active) →
Asset return(blocks completion while active) → IT revocation(tracked) →
Settlement(breakdown + payment confirmation) → Exit docs(NOC, experience cert, final payslip) →
Exit interview → Record closed; employee status → Exited(soft)
```
**DB:** `offboarding_records` settlement fields + `visa_type`; link clearance tasks to `asset_assignments`; `eosbService` not a table. **API:** approval gate, `services/eosbService.js` (pure, tested), block completion while `asset_assignments.status='Active'`, generate exit letters. **Frontend:** settlement breakdown, EOSB calculation trace, asset-return checklist auto-populated.

**EOSB rule set to implement (UAE, unlimited contract baseline):**
- Service < 1 year → no gratuity.
- 1–5 years → 21 days basic wage per year.
- > 5 years → 21 days/year for first 5 + 30 days/year thereafter.
- Resignation (limited/unlimited) reductions per current labour law.
- Cap total at 2 years' wage; deduct unpaid leave days; daily wage = basic/30 (document the divisor choice).
Implement as a versioned function with a breakdown object; cover with unit tests against published worked examples.

---

## 4. Employee Lifecycle & Profile Management

**Current flow** (`employees.js`): create (manual or via hire), update in place, status ENUM (`Onboarding/Active/Offboarding/Exited`), assets + performance attached.

**Problems:** updates overwrite with no history (WF-009) — no salary/title/department audit; IDOR on get/update/delete (TEN-002); hard delete available (DB-010); employee code scheme unspecified (CQ-013); no promotion/transfer/contract-renewal tracking.

**Recommended:** every material change writes an `employee_history` row (field, old, new, changed_by, effective_date); deletes become status transitions; per-company `EMP-{code}-{seq}`; contract + salary structure linked (see §6, §8).

**DB:** `employee_history`, `employment_contracts`, `salary_structures`. **API:** history on update, soft delete, transfer endpoint. **Frontend:** history timeline on employee profile.

---

## 5. Performance & KPI

**Current flow** (`performance.js`, `kpi.js`): create quarterly target (amount, currency), sign (sets `signed_at`); KPI hire/commission tiers.

**Problems:** signing unauthenticated and unscoped (TEN-008); targets never scored against actuals — no review cycle, no achievement tracking; KPI tiers global across tenants (TEN-010).

**Recommended flow:**
```
Define cycle → Set targets(employee+manager) → Mid-cycle check-in →
Record actuals → Score/rating → Calibration → Sign-off(employee+manager) →
Outcomes(raise/promotion/PIP) feed lifecycle
```
**DB:** `review_cycles`, `target_actuals`, scope `kpi_tiers/targets` by company. **API:** signing authz (employee or manager only), actuals capture, cycle management. **Frontend:** review cycle UI, achievement vs target charts.

---

## 6. Contracts & Documents

**Current flow** (`legal.js`, `documents.js`): generate letters via AI (8 types), store generated letters; upload company documents as LONGBLOB, download/delete.

**Problems:** no contract lifecycle (no expiry, renewal, signature trail); IDOR on letters/documents (TEN-002); no versioning; letters lack approver identity; no document-expiry reminders (visas, contracts) (WF-010); blobs in DB (DB-009).

**Recommended flow:**
```
Contract draft → Review/approve → e-sign(or upload signed) → Active(expiry tracked) →
Reminder(T-60/30/7 before expiry) → Renew/terminate → Archive(versioned)
```
**DB:** `employment_contracts` (type, dates, salary, file_ref, signed_at, status, version), `documents.expiry_date`, `generated_letters.approved_by`. **API:** expiry reminder job (→ notifications/email), versioning, company-scoped access, optional e-sign integration. **Frontend:** expiry dashboard, contract timeline, version history.

---

## 7. Assets & Inventory

**Current flow** (`assets.js`, `inventory.js`): two systems — `asset_assignments` (who has what, encrypted account passwords, handover receipts) and `asset_inventory` (physical catalog, barcodes/QR, status), loosely linked by optional `inventory_id`; `platform_catalog.inventory_total` decremented on assign.

**Problems:** counts drift between the two (WF-003); double-assignment possible; cross-company `reveal-password` (TEN-006); no depreciation/maintenance/disposal/warranty tracking; encrypted passwords under weak-fallback key (SEC-012).

**Recommended flow:**
```
Procure → Inventory item(asset_inventory, single source) →
Assign(transaction: status Assigned + assignment row + handover receipt) →
In-use(maintenance/repair history) → Return(transaction: status Available + condition) →
Depreciate → Dispose(tracked)
```
**DB:** make `asset_assignments.inventory_id` NOT NULL for hardware; drop count-decrement pattern in favor of status; add maintenance/depreciation fields. **API:** transactional assign/return updating both tables; company-scope + authz on reveal (audited). **Frontend:** single asset view merging catalog + assignment.

---

## 8. Attendance, Leave, Payroll (MISSING — must be built)

Confirmed absent across server and client (only a Payroll page with standalone calculators exists). These are core HR operations and UAE compliance requirements.

**Attendance (target):**
```
Check-in/out (web/biometric/import) → Daily records → Exceptions(late/absent) →
Monthly timesheet → Approval → Feed payroll deductions
```
**Leave (target):**
```
Accrual policy → Balance per type → Employee request → Manager approval(workflow) →
Balance debit → Calendar → Feed payroll/attendance
```
**Payroll (target):**
```
Salary structure(earnings/deductions) → Payroll run(period) →
Pull attendance + leave + adjustments → Compute gross/net → Approval →
Payslips(stored) → Payment file/confirmation → GL/accounting export
```
**DB:** `attendance`, `leave_types`, `leave_balances`, `leave_requests`, `holidays`, `shifts`, `salary_components`, `salary_structures`, `payroll_runs`, `payroll_items`. **API:** full CRUD + approval + computation services. **Frontend:** ESS request screens, manager approval inbox, payroll run console, payslip viewer. See `09_FEATURE_ENHANCEMENT_PLAN.md` F-01…F-05.

---

## 9. Approval Hierarchy & Delegation (MISSING)

No maker-checker anywhere (WF-002). A single recruiter can hire; HR can offboard unilaterally; leave/payroll will need approvals.

**Recommended generic engine:**
```
approval_requests(entity_type, entity_id, requested_by, chain[], current_step, status)
→ notify approver → approve/reject(+comment) → advance or finalize → callback updates entity
```
Configurable chains per entity type and company; delegation (out-of-office) support. Wire into hire, offboarding initiation, leave, payroll-run, salary change.

---

## 10. Notifications (MISSING in-app)

Email templates exist (20+) but there is no in-app notification center; the Topbar bell is decorative (UI-003). 

**Recommended:** `notifications(user_id, company_id, type, title, body, link, is_read, created_at)`; event producers across workflows (SLA breach, approval pending, document expiry, leave decision); bell + dropdown + preferences; email as fallback channel via the existing service (add queue/retry — WF-004).

---

## 11. Email System

**Current** (`email.js`, `emailService.js`, `emailTemplates.js`): per-company SMTP config (encrypted), 20+ templates, test connection, bulk send (200 ms delay).

**Problems:** synchronous bulk send blocks request (PERF-002); no retry/queue (WF-004); TLS verification disabled (SEC-007); config saved unverified (WF-011); header injection possible (SEC-018); logs unscoped by company (TEN-009); templates EN-only (CQ-005).

**Recommended:** DB/BullMQ queue with retry + status; verify SMTP before save; validate recipients/strip CRLF; scope logs; localize templates; keep transporter cache with invalidation on config change.

---

## 12. Reports & Dashboard

**Current** (`reports.js`, `dashboard.js`): pipeline, journey, employee, onboarding reports; dashboard stats/funnel/activity/hires-chart computed live.

**Problems:** global cross-company queries (TEN-004, TEN-005); live aggregates don't scale (PERF-001); no export; limited metrics (no cost/time-to-hire, retention); no drill-down or scheduling.

**Recommended:** scope all by `req.companyId`; cache stats per company (60 s); add export (CSV/XLSX); add HR KPI metrics; drill-down links; scheduled email reports via the queue.

---

## Workflow change summary

| Workflow | Status | Top change required |
|---|---|---|
| Recruitment | ⚠ works, gaps | Interviews/offers/rejection + sanitize AI + tenant scope |
| Onboarding | ⚠ works, unsafe | Authz on steps + SLA enforcement + notifications |
| Offboarding | ⚠ works, incorrect | Correct EOSB engine + clearance linked to live state + approvals |
| Employee lifecycle | ⚠ | Change history + soft delete + contracts |
| Performance/KPI | ⚠ partial | Authz signing + review cycle + actuals + tenant-scope tiers |
| Contracts/Documents | ⚠ partial | Lifecycle, expiry reminders, versioning, scope |
| Assets/Inventory | ⚠ duplicated | Unify, transactional, scope reveal |
| Attendance | ✗ | Build module |
| Leave | ✗ | Build module |
| Payroll | ✗ | Build module |
| Approvals | ✗ | Build engine |
| Notifications (in-app) | ✗ | Build module |
| Email | ⚠ | Queue/retry, TLS, scope, validate |
| Reports/Dashboard | ⚠ | Scope, cache, export, metrics |
