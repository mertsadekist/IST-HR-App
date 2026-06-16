# 06 — Bug Fixing & Improvement Plan (Phased)

**Audit date:** 2026-06-11

Seven phases, ordered by risk. **Phase 1 is a release blocker** — do not expose the system to more than one company or any untrusted user until it is complete. Each phase lists tasks, priority, related files, expected result, dependencies, and acceptance criteria. Task IDs map to `01_FULL_AUDIT_REPORT.md` and `07_DEVELOPMENT_TASK_TRACKER.md`.

---

## Phase 1 — Critical Security & Data Isolation (release blocker)

**Goal:** Make the system safe to run with multiple tenants and untrusted users.

| Task | Priority | Findings | Related files |
|---|---|---|---|
| Rotate all secrets; firewall DB; remove hardcoded creds | P0 | SEC-001, SEC-002 | `.env`, `check_db.mjs`, `migrate_employee_onboarding.mjs`, `seed-offboarding.js` |
| Add `tenantScope` middleware; derive tenant from token | P0 | TEN-001/004/005 | new `middleware/tenant.js`, `app.js`, all data routes |
| Add `AND company_id=?` to all `:id` queries (404 on mismatch) | P0 | TEN-002, TEN-006 | all `routes/*` |
| Guard `PUT /api/users/:id` + field whitelist | P0 | SEC-005 | `routes/users.js` |
| Authorize on/offboarding checklist/step/email endpoints | P0 | TEN-007 | `routes/onboarding.js`, `offboarding.js` |
| Add `company_id` to `audit_logs`; scope reads | P0 | TEN-003 | `schema.sql`, migration, `routes/audit.js`, `dashboard.js`, `services/auditService.js` |
| Scope reports + dashboard by token tenant | P0 | TEN-004, TEN-005 | `routes/reports.js`, `dashboard.js` |
| Fix upload filter (reject non-allowlisted + magic bytes) | P0 | SEC-004 | `middleware/upload.js` |
| Replace default admin password with random + forced change | P0 | SEC-003 | `schema.sql`, `setup-db.js` |
| Whitelist table names in backup import | P0 | SEC-006 | `routes/backup.js` |
| Soft-delete companies; block hard cascade delete | P1 | DB-001 | `schema.sql`, `routes/companies.js` |

**Dependencies:** secret rotation first (ops); `audit_logs` change before audit-scope code.
**Expected result:** No authenticated user can read/write/delete another company's data or escalate privilege; secrets rotated and off-repo; uploads constrained.
**Acceptance criteria:**
- `server/tests/isolation.test.js` passes for all endpoints (cross-tenant → 404; param `company_id` ignored).
- Non-admin `PUT /api/users/:id` → 403; cannot change role/company.
- `employee` role on checklist/step/email endpoints → 403.
- Upload of `.exe`/`.html` → 400.
- `grep -r "qCIqfJ0\|admin123"` returns nothing in tracked files; DB unreachable publicly.
- `DELETE /api/companies/:id` archives; data intact.

---

## Phase 2 — Broken Core HR Operations & High-Risk Logic

**Goal:** Fix incorrect/unsafe business logic and remaining high-severity security gaps.

| Task | Priority | Findings | Related files |
|---|---|---|---|
| `express-rate-limit` (login, AI, email, global) | P1 | SEC-010, SEC-016 | `app.js`, `routes/auth.js`, `ai.js`, `email.js` |
| Remove `rejectUnauthorized:false` (DeepSeek, SMTP) | P1 | SEC-007 | `services/deepseekService.js`, `emailService.js` |
| Authenticate + rate-limit `parse-cv` | P1 | SEC-013 | `routes/candidates.js` |
| Sanitize CV→LLM; clamp returned score | P1 | SEC-008 | `services/deepseekService.js` |
| Remove hardcoded PII fallback | P1 | SEC-009 | `services/deepseekService.js` |
| Correct EOSB engine (pure, tested) | P1 | WF-001 | new `services/eosbService.js`, `routes/offboarding.js` |
| Scope email logs/stats by company | P1 | TEN-009 | `routes/email.js` |
| Authorize performance signing | P1 | TEN-008 | `routes/performance.js` |
| `zod` validation layer on all writes | P1 | API-001 | new `middleware/validate.js`, all `routes/*` |
| Per-company email uniqueness + duplicate checks | P1 | DB-004 | `schema.sql`, `routes/employees.js`, `candidates.js`, `users.js` |
| Reduce JSON body limit; clamp pagination | P2 | SEC-016, API-002 | `app.js`, list routes |
| Move JWT to httpOnly cookie or short token+refresh | P2 | SEC-011, SEC-015 | `routes/auth.js`, `middleware/auth.js`, client `authSlice.js`, `axios.js` |

**Dependencies:** validation middleware (R1) before per-route schemas; EOSB service unit-tested before wiring.
**Expected result:** Correct settlements; AI hardened; brute-force/DoS throttled; validated inputs; no cross-company email leakage.
**Acceptance criteria:**
- EOSB unit tests match published UAE worked examples (incl. <1yr, >5yr, resignation).
- Login limited to 5/15min; AI/email endpoints throttled.
- Malformed payloads → 422 with field errors.
- Duplicate employee email per company → friendly 409.
- No `rejectUnauthorized:false` in codebase.

---

## Phase 3 — Database & API Improvements

**Goal:** Structural data integrity, performance indexing, migration discipline, RBAC model.

| Task | Priority | Findings | Related files |
|---|---|---|---|
| Adopt migration framework; baseline schema; remove ad-hoc runners | P1 | DB-005 | `db/migrations/`, delete `migrate*.js/.mjs/.cjs` |
| Roles/permissions tables + permission-based RBAC | P1 | DB-003, SEC-014 | `schema.sql`, `middleware/rbac.js`, all routes |
| Composite indexes (company_id,status) etc. | P2 | DB-006 | `indexes.sql`/migration |
| SLA columns → `INT hours` | P2 | DB-007 | `schema.sql`, on/offboarding routes |
| `asset_inventory` unique per company | P2 | DB-008 | migration |
| Company-scope shared config tables (copy-on-write) | P2 | TEN-010 | `schema.sql`, `routes/settings.js`, `legal.js`, `kpi.js` |
| Standard soft-delete (`deleted_at`) + default scope | P2 | DB-010 | schema + routes |
| Stage history `ON DELETE RESTRICT` | P3 | DB-011 | `schema.sql` |
| NOT NULL backfills + `checked_by` + seniority unique | P3 | DB-012 | schema + routes |
| Employee change history table | P2 | WF-009 | `schema.sql`, `routes/employees.js` |
| Move file blobs to object storage + signed URLs | P2 | DB-009 | `documents.js`, `candidates.js`, storage service |
| Central response serializer (strip secrets) + error envelope | P2 | SEC-019, API-003 | new `middleware/errorHandler.js`, serializers |

**Dependencies:** migration framework first; RBAC tables before permission middleware.
**Expected result:** Versioned reversible schema; extensible roles; faster tenant queries; recoverable deletes; files off the DB.
**Acceptance criteria:** migrations run up/down cleanly in CI; permission checks enforce per-action access; `EXPLAIN` shows index use on tenant+status queries; deleted records recoverable; documents served via signed URLs with nosniff/attachment.

---

## Phase 4 — UI/UX Fixes

**Goal:** Remove broken/placeholder UI, fix correctness/UX bugs, improve a11y.

| Task | Priority | Findings | Related files |
|---|---|---|---|
| Remove mock work-history/salary fallbacks | P1 | UI-001 | `pages/recruitment/Candidates.jsx` |
| Reset modal state between records | P2 | UI-006 | `Candidates.jsx` |
| Wire or hide Topbar search & notification bell | P2 | UI-002, UI-003 | `components/partials/Topbar.jsx` |
| Add `allowedRoles` to ProtectedRoute | P1 | SEC-014 | `components/shared/ProtectedRoute.jsx`, router |
| Sanitize `dangerouslySetInnerHTML` sinks | P2 | SEC-017 | `Inventory.jsx`, `OrgChart.jsx`, `Assets.jsx` |
| Adopt react-hook-form+zod; central client error handling | P2 | API-003, CQ-006 | `api/*`, form components |
| Strip debug logging; env-driven API URL | P3 | CQ-003, CQ-011 | `vite.config.js`, `axios.js`, pages |
| Accessibility pass (ARIA, text+color status, focus traps) | P3 | UI-005 | components |
| Localize remaining strings + email templates | P3 | CQ-005 | `Sidebar.jsx`, `emailTemplates.js`, locales |
| Null-safety + clipboard/timer fixes | P3 | CQ-008, CQ-009 | `Candidates.jsx`, `MyAssets.jsx` |

**Dependencies:** Phase 1 (ProtectedRoute roles complement backend RBAC).
**Expected result:** No misleading/dead controls; consistent validation/error UX; baseline a11y; clean production build.
**Acceptance criteria:** no fabricated data shown; axe scan has no critical violations; no `console.*` in production bundle; all visible controls perform an action or are removed.

---

## Phase 5 — Performance & Scalability

**Goal:** Sustain large tenants and many companies.

| Task | Priority | Findings | Related files |
|---|---|---|---|
| Cache dashboard/report stats per company (60s) | P2 | PERF-001 | `routes/dashboard.js`, `reports.js` |
| Async email queue + retry (BullMQ or DB queue) | P2 | WF-004, PERF-002 | `services/emailService.js`, worker |
| Stream uploads/downloads; object storage | P2 | DB-009, SEC-016 | upload/download routes |
| Verify composite indexes via EXPLAIN on big data | P2 | DB-006 | migrations, perf tests |
| Add pagination everywhere; enforce caps | P2 | API-002 | list routes |
| Consider process clustering / PM2; connection pool tuning | P3 | SEC-016 | deployment |

**Dependencies:** Phase 3 indexes + storage.
**Expected result:** Sub-second dashboards at 10k+ employees/company; non-blocking bulk email; bounded memory.
**Acceptance criteria:** load test (50k attendance rows, 5k employees, 5 companies) keeps p95 API < 500 ms; bulk email of 1k returns immediately with a job id.

---

## Phase 6 — Additional Features & Enhancements

**Goal:** Build the missing HR core and high-value modules (detailed in `09_FEATURE_ENHANCEMENT_PLAN.md`).

| Task | Priority | Feature |
|---|---|---|
| Attendance module | P1 | F-01 |
| Leave management + approvals | P1 | F-02 |
| Payroll engine + payslips | P1 | F-03 |
| Approval workflow engine | P1 | F-04 |
| In-app notifications | P2 | F-08 |
| Contract lifecycle + expiry reminders | P2 | F-05/F-09 |
| Performance review cycles | P2 | F-13 |
| Expanded ESS portal | P2 | F-06 |
| HR analytics dashboard | P3 | F-07 |
| Interviews/offers in ATS | P2 | WF-007 |
| Integrations (biometric, accounting/ERP), AI assistant | P3 | F-18…F-21 |

**Dependencies:** Phases 1–3 (security, RBAC, schema, migrations) must precede new modules so they inherit tenant scoping and validation by construction.
**Expected result:** System covers full employee lifecycle and core HR operations.
**Acceptance criteria:** each feature ships with tenant-scoped APIs, validation, RBAC, tests, and isolation coverage; UAE leave/EOSB/payroll rules verified with finance/HR sign-off.

---

## Phase 7 — Testing & Deployment

**Goal:** Lock in quality and ship safely.

| Task | Priority | Related |
|---|---|---|
| Unit tests (eosb, leave accrual, payroll, validation) | P1 | `08_TESTING_PLAN.md` §3 |
| Integration tests per module | P1 | §4 |
| Automated company-isolation suite in CI | P0 | §7 |
| Security tests (authz, IDOR, injection, upload) | P1 | §6 |
| E2E happy paths (Playwright/Cypress) | P2 | §5 |
| CI pipeline (lint, test, isolation gate, build) | P1 | — |
| Staging deploy + UAT | P1 | `10_RELEASE_AND_DEPLOYMENT_PLAN.md` |
| Production deploy + monitoring/logging | P1 | `10_...` |

**Dependencies:** all prior phases.
**Expected result:** Regressions caught automatically; isolation guaranteed on every PR; observable production.
**Acceptance criteria:** CI green and blocking on isolation/security suites; coverage targets met (services ≥80%); staged rollout with rollback rehearsed; post-deploy validation checklist passes.

---

## Sequencing summary

```
Phase 1 (blocker) ─┬─> Phase 2 ─┬─> Phase 3 ─┬─> Phase 5
                   │            │            └─> Phase 6 (new modules)
                   └─> Phase 4  └────────────────> Phase 7 (continuous, gated in CI)
```
Phase 1 before any further exposure. Phases 2–4 can partly parallelize across security/logic vs UI tracks. Phase 6 modules must wait for the Phase 1–3 foundations.
