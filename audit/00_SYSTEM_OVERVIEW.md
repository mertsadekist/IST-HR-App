# 00 — System Overview

**Audit date:** 2026-06-11
**Auditor:** Full-stack architecture, security, QA, and workflow audit (automated + manual review)
**Project root:** `D:\Cloude\IST_HR_System`

---

## 1. System Summary

IST HR System is a multi-company Human Resources Management System built as a React SPA backed by a Node.js/Express REST API and a remote MySQL database. It evolved from a single-file localStorage SPA (`IST_HR_System 3.html`, 902 KB, still in the repo) into the current client/server architecture — and several legacy patterns (client-supplied `company_id`, the `/api/migrate/localStorage` import endpoint) survive from that origin.

The system is **strong on recruitment (ATS), onboarding/offboarding, and asset management**, and **missing the core HR operations layer entirely**: there is no attendance tracking, no leave management, no payroll engine, no contracts lifecycle, no in-app notifications, and no approval workflows. Multi-company support exists at the schema level (`company_id` on most tables) but is **not enforced at the API level** — this is the single most important finding of the audit.

## 2. Main Modules Found

| Module | Backend route | Frontend page(s) | State |
|---|---|---|---|
| Authentication | `server/routes/auth.js` | `pages/auth/Login.jsx` | Working; no rate limit, no refresh/revocation |
| Companies | `routes/companies.js` | `pages/settings/CompanySettings.jsx` | Working |
| Departments / Job titles / Skills | `departments.js`, `jobTitles.js`, `skills.js` | settings pages | Working |
| Users & roles | `routes/users.js` | `pages/admin/UserManagement.jsx` | **Privilege-escalation bug** |
| Recruitment (vacancies, candidates, ATS, CV scorer, AI) | `vacancies.js`, `candidates.js`, `cvScorer.js`, `ai.js` | `pages/recruitment/*` | Working; tenant isolation broken; mock fallback data in UI |
| Employees | `employees.js` (+ dead `employees_additions.js`) | `pages/lifecycle/Employees.jsx` | Working; IDOR issues |
| Onboarding / Offboarding | `onboarding.js`, `offboarding.js` | `pages/lifecycle/*` | Working; missing authz on checklist endpoints; EOSB oversimplified |
| Assets & Inventory | `assets.js`, `inventory.js` | `Assets.jsx`, `Inventory.jsx` | Two overlapping systems; cross-company password reveal |
| Legal letters & Documents | `legal.js`, `documents.js` | `pages/legal/*` | Working; IDOR; no expiry/versioning |
| Performance / KPI | `performance.js`, `kpi.js` | `Performance.jsx`, `KPITracker.jsx` | Partial; unauth signing |
| Reports & Dashboard | `reports.js`, `dashboard.js` | `pages/analytics/*`, `Dashboard.jsx` | Working; **global cross-company queries** |
| Email | `email.js` + `services/emailService.js` | `EmailSettings.jsx`, `EmailLog.jsx` | Working; no queue/retry; TLS validation off |
| Employee portal | `portal.js` | `MyAssets.jsx` etc. | Very limited (assets only) |
| Audit log | `audit.js` | `AuditLog.jsx` | Exists; **no company_id column** |
| Backup / Migration | `backup.js`, `migrate.js` | SystemConfig | Admin-only; arbitrary-table import flaw |
| **Attendance** | — | — | **MISSING** |
| **Leave management** | — | — | **MISSING** |
| **Payroll engine** | — | `pages/legal/Payroll.jsx` (calculators only) | **MISSING** (UI calculators, no payroll runs/payslips) |
| **Notifications (in-app)** | — | Topbar bell (decorative) | **MISSING** |
| **Contracts lifecycle** | — | — | **MISSING** |

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Redux Toolkit, React Router v6 (lazy routes), TailwindCSS, Radix UI, i18next (EN/AR + RTL), react-toastify, SweetAlert2, recharts, framer-motion |
| Backend | Node.js (ESM), Express 4, helmet, cors, morgan, multer (memory storage), nodemailer, bcryptjs, jsonwebtoken |
| Database | MySQL (remote: `147.93.27.94:5458`), `mysql2/promise` pool (limit 10), raw SQL — no ORM, no migration framework |
| AI | DeepSeek API (CV analysis, letter generation, JD generation, interview questions) |
| Files | Stored as `LONGBLOB` in MySQL (documents) + `uploads/` folder at repo root |
| Tests | `server/tests/api.test.js`, `e2e.test.js` (~42 smoke tests) |

## 4. Current Architecture

```
client (Vite SPA, port 5173)
  └─ /api proxy → server (Express, port 3001)
       ├─ middleware: auth (JWT verify) → authorize(roles)
       ├─ 28 route modules (raw SQL via mysql2 pool)
       ├─ services: audit, crypto (AES-256-GCM), email, DeepSeek, barcode, CV parser
       └─ MySQL @ 147.93.27.94:5458 (45 tables)
```

- **Tenancy model:** shared database, shared schema, `company_id` column discriminator. JWT carries `{id, name, role, company_id}` but routes trust `company_id` from **query/body parameters** instead of the token.
- **Roles:** 4 hardcoded ENUM roles (`admin`, `hr_manager`, `recruiter`, `employee`). No permissions tables, no per-company role scoping.
- **Company switching:** Sidebar entity switcher dispatches Redux state; filtering is client-driven (spoofable).

## 5. Main Risks

1. **Cross-company data leakage (CRITICAL).** ~47 endpoints either accept a caller-supplied `company_id` or perform `:id` lookups with no company scoping. Any authenticated user of Company A can read/modify Company B's employees, candidates, documents, assets (including revealing encrypted asset passwords), KPI, letters, and audit logs.
2. **Exposed production secrets (CRITICAL).** `.env` holds live DB password, JWT secret, DeepSeek API key, and the AES encryption key; the same DB password is hardcoded in `server/check_db.mjs` and `server/migrate_employee_onboarding.mjs`. The DB is on a public IP.
3. **Privilege escalation (CRITICAL).** `PUT /api/users/:id` has no role check — any user can promote themselves to admin or change their `company_id`.
4. **Default credentials (CRITICAL).** `admin / admin123` is seeded by `schema.sql` and `setup-db.js`.
5. **Unrestricted file upload (CRITICAL).** `middleware/upload.js` fileFilter falls through to `cb(null, true)` for every file type.
6. **Missing HR core (HIGH).** No attendance, leave, payroll runs, or contracts — the system cannot run actual HR operations or meet UAE labor-law record-keeping requirements.
7. **No audit tenancy (HIGH).** `audit_logs` has no `company_id`; audit trail cannot be segregated per tenant (compliance failure).
8. **AI trust issues (HIGH).** CV text is injected unsanitized into DeepSeek prompts (prompt injection → score manipulation); a real person's PII is hardcoded as the parse-failure fallback in `deepseekService.js:224-305`.

## 6. General System Status

| Dimension | Rating | Comment |
|---|---|---|
| Functional completeness (recruitment→offboarding) | 🟡 Fair | ATS/onboarding/offboarding/assets work end-to-end |
| Functional completeness (HR operations) | 🔴 Poor | Attendance/leave/payroll absent |
| Security | 🔴 Critical | Not safe for production with >1 company or untrusted users |
| Multi-company isolation | 🔴 Critical | Schema-ready, API-broken |
| Code quality | 🟡 Fair | Clean patterns, parameterized SQL, but no validation layer, monolithic pages, dead code |
| Database design | 🟡 Fair | Good FK/index baseline; missing constraints, tables, migration framework |
| UX | 🟢 Good | Modern UI, i18n+RTL, loading/empty states; some decorative/unwired elements |
| Test coverage | 🟡 Fair | 42 smoke tests; no security/isolation/edge-case tests |
| **Production readiness** | 🔴 **NOT READY** | Block release until Phase 1 of `06_BUG_FIXING_PLAN.md` is complete |

## 7. Priority Summary

| Severity | Count | Examples |
|---|---|---|
| **Critical** | 14 | Tenant isolation (TEN-001/002/003), secrets exposure (SEC-001/002), privilege escalation (SEC-005), default admin password (SEC-003), open file upload (SEC-004) |
| **High** | 22 | No rate limiting, JWT in localStorage, prompt injection, PII fallback, EOSB calculation, no approval workflows, missing HRMS tables, no validation layer, mock data shown as real |
| **Medium** | 26 | Dual asset systems, no email queue/retry, SLA as VARCHAR, missing composite indexes, dangerouslySetInnerHTML, dead search/bell UI, modal state leaks |
| **Low** | 13 | Dead code, console logging, hardcoded lists, untranslated strings, unused dependencies |
| **Total** | **75** | Full register in `01_FULL_AUDIT_REPORT.md` |

**Immediate actions (this week):** rotate every secret in `.env`; take the DB off the public internet or firewall it; fix `users.js` privilege escalation; enforce `req.user.company_id` server-side everywhere; change/force-rotate the default admin password; fix the upload filter.

## 8. Document Index

| File | Content |
|---|---|
| `01_FULL_AUDIT_REPORT.md` | Master findings register (75 findings with IDs) |
| `02_SECURITY_AUDIT.md` | Security deep-dive, risk matrix, fix checklist |
| `03_MULTI_COMPANY_ARCHITECTURE_REVIEW.md` | Tenant isolation analysis and target architecture |
| `04_CODE_STRUCTURE_REVIEW.md` | Code quality, structure, refactoring roadmap |
| `05_WORKFLOW_AND_BUSINESS_LOGIC_REVIEW.md` | Per-workflow analysis and improved flows |
| `06_BUG_FIXING_PLAN.md` | 7-phase remediation plan with acceptance criteria |
| `07_DEVELOPMENT_TASK_TRACKER.md` | Task tracker table |
| `08_TESTING_PLAN.md` | Manual/automated/security/isolation test plan |
| `09_FEATURE_ENHANCEMENT_PLAN.md` | Feature roadmap (attendance, leave, payroll, etc.) |
| `10_RELEASE_AND_DEPLOYMENT_PLAN.md` | Deployment, migration, rollback, monitoring |
