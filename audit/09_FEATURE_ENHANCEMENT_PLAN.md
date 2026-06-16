# 09 — Feature Enhancement Plan

**Audit date:** 2026-06-11

Features the HRMS needs to become a complete platform. Complexity: S/M/L/XL. Priority reflects both business value and dependency order (security/RBAC/schema foundations from Phases 1–3 first).

**Build rule for every feature:** tenant-scoped APIs (`req.companyId`), `zod` validation, permission-based RBAC, audit logging, and isolation tests — by construction, not afterthought.

---

## Core HR operations (highest value — currently missing)

### F-01 — Attendance Tracking
- **Description:** Daily check-in/out (web + import + biometric feed), exceptions (late/absent/early-leave), monthly timesheets, manager approval.
- **Business value:** Mandatory for payroll deductions and UAE labor-law records; foundation for leave/payroll.
- **Required modules:** new `attendance`; integrates with leave, payroll, holidays, shifts.
- **Priority:** P1 · **Complexity:** L
- **Implementation:** tables `attendance`, `shifts`, `shift_assignments`, `holidays`; `/api/attendance` CRUD + monthly report; ESS self check-in; biometric import endpoint (F-19).

### F-02 — Advanced Leave Management
- **Description:** Leave types, accrual policies, balances, request→approval workflow, calendar, encashment.
- **Business value:** Core ESS feature; legal entitlement tracking; feeds payroll.
- **Required modules:** new `leave`; uses approval engine (F-04), notifications (F-08).
- **Priority:** P1 · **Complexity:** L
- **Implementation:** tables `leave_types`, `leave_balances`, `leave_requests`; accrual job; manager inbox; balance debit on approval.

### F-03 — Payroll Automation
- **Description:** Salary structures (earnings/deductions), monthly payroll runs pulling attendance+leave, gross→net, approval, payslip generation/storage, bank file + accounting export.
- **Business value:** Replaces the calculator-only Payroll page with a real engine; the central HR deliverable.
- **Required modules:** new `payroll`; depends on attendance (F-01), leave (F-02), contracts (F-05), approvals (F-04).
- **Priority:** P1 · **Complexity:** XL
- **Implementation:** tables `salary_components`, `salary_structures`, `payroll_runs`, `payroll_items`; `payrollService` (pure, tested); payslip PDF; finance/HR sign-off on rules.

### F-04 — Approval Workflow Engine
- **Description:** Generic maker-checker for hire, offboarding, leave, salary change, payroll run; configurable chains per company; delegation.
- **Business value:** Governance/compliance control absent today (WF-002).
- **Required modules:** new `approvals`; consumed by most workflows.
- **Priority:** P1 · **Complexity:** L
- **Implementation:** `approval_requests` (entity, chain, current_step, status) + UI inbox + callbacks.

### F-05 — Contract Management
- **Description:** Employment contracts with type/dates/salary, e-sign or upload, status, versioning, renewal.
- **Business value:** Legal record; drives payroll and expiry reminders.
- **Required modules:** new `contracts`; uses documents, notifications.
- **Priority:** P2 · **Complexity:** M
- **Implementation:** `employment_contracts` table; lifecycle states; optional DocuSign/Adobe Sign (F-20).

### F-06 — Employee Self-Service Portal (expanded)
- **Description:** Beyond assets: payslips, leave balance + requests, attendance, documents, profile updates (with approval), notifications.
- **Business value:** Reduces HR load; primary employee touchpoint.
- **Required modules:** `portal` extended; depends on F-01/02/03/08.
- **Priority:** P2 · **Complexity:** L

---

## Workflow & analytics enhancements

### F-07 — HR Analytics Dashboard
- **Description:** Headcount, turnover/retention, time-to-hire, cost-per-hire, attendance/leave trends, payroll cost; export + scheduled email.
- **Business value:** Executive decision support.
- **Priority:** P3 · **Complexity:** M · scope all by tenant; cache (PERF-001).

### F-08 — In-App Notifications
- **Description:** Notification center (bell), per-event producers (SLA breach, approval pending, expiry, leave decision), preferences, email fallback.
- **Business value:** Replaces decorative bell (UI-003); ties workflows together.
- **Priority:** P2 · **Complexity:** M · table `notifications`.

### F-09 — Document Expiry Reminders
- **Description:** Track expiry for visas, passports, contracts, certifications; T-60/30/7 reminders.
- **Business value:** Compliance; avoids illegal expired-document working.
- **Priority:** P2 · **Complexity:** S · add `expiry_date` + scheduled job → F-08/email.

### F-10 — Company Policies & Acknowledgements
- **Description:** Policy library, version, employee acknowledgement tracking.
- **Priority:** P3 · **Complexity:** M.

### F-11 — Recruitment: Interviews & Offers
- **Description:** Interview scheduling + scorecards, offer generation/acceptance, rejection reasons (WF-007).
- **Priority:** P2 · **Complexity:** L.

### F-12 — Onboarding/Offboarding upgrades
- **Description:** Pre-boarding, equipment requisition, SLA escalation, exit clearance linked to live asset/account state, settlement breakdown (WF-005/006).
- **Priority:** P2 · **Complexity:** L.

### F-13 — Performance Evaluation Cycles
- **Description:** Review cycles, goals + actuals, 360 feedback, ratings, calibration, outcomes (raise/PIP).
- **Priority:** P2 · **Complexity:** L.

### F-14 — Recruitment Module depth
- **Description:** Career-site/job-board posting, application intake, talent pool, referrals.
- **Priority:** P3 · **Complexity:** L.

### F-15 — Asset Management upgrade
- **Description:** Unify the two asset systems (WF-003); depreciation, maintenance, warranty, disposal.
- **Priority:** P2 · **Complexity:** L.

### F-16 — Training Management
- **Description:** Courses, enrollments, completion/certs, training matrix.
- **Priority:** P3 · **Complexity:** M.

---

## Platform & integrations

### F-17 — Multi-language support (complete)
- **Description:** Finish i18n: localize remaining strings + email templates; per-user language; Arabic payroll/letter formats.
- **Priority:** P3 · **Complexity:** S (CQ-005).

### F-18 — Mobile support
- **Description:** Responsive/PWA or RN app for ESS (check-in, leave, payslips, approvals).
- **Priority:** P3 · **Complexity:** L.

### F-19 — Biometric attendance integration
- **Description:** Device/SDK ingestion (ZKTeco etc.) → attendance.
- **Priority:** P3 · **Complexity:** M · depends F-01.

### F-20 — E-signature integration
- **Description:** DocuSign/Adobe Sign for contracts/letters/offers.
- **Priority:** P3 · **Complexity:** M · depends F-05.

### F-21 — Accounting/ERP integration
- **Description:** Export payroll to accounting (QuickBooks/Zoho/SAP); GL mapping.
- **Priority:** P3 · **Complexity:** L · depends F-03.

### F-22 — AI HR Assistant
- **Description:** Reuse DeepSeek for policy Q&A, JD generation, candidate summaries (sanitized — SEC-008), attrition insights.
- **Priority:** P3 · **Complexity:** M · build on hardened AI layer.

---

## Recommended build order

```
Foundations (audit Phases 1–3: security, RBAC, schema, migrations)
   ↓
F-04 Approvals → F-01 Attendance → F-02 Leave → F-05 Contracts → F-03 Payroll
   ↓
F-08 Notifications, F-09 Expiry, F-06 ESS, F-11 Interviews/Offers, F-12 On/Offboarding upgrades, F-15 Assets
   ↓
F-07 Analytics, F-13 Performance, F-17 i18n
   ↓
F-18 Mobile, F-19 Biometric, F-20 E-sign, F-21 Accounting, F-22 AI assistant, F-10/F-14/F-16
```

Payroll (F-03) is the keystone deliverable but sits late because it depends on attendance, leave, contracts, and approvals. Build those first.
