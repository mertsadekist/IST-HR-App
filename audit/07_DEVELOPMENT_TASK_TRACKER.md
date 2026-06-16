# 07 — Development Task Tracker

**Audit date:** 2026-06-11 · **Status legend:** Not Started · In Progress · Blocked · Needs Review · Done

All tasks start **Not Started / Unassigned**. Priority: P0 (blocker) > P1 > P2 > P3. Finding IDs cross-reference `01_FULL_AUDIT_REPORT.md`.

---

## Phase 1 — Critical Security & Data Isolation

| Task ID | Task | Module | Priority | Status | Assigned | Related file(s) | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| T-001 | Rotate all secrets; remove from repo; firewall DB | Config | P0 | Not Started | — | `.env` | Old secrets rejected; DB not publicly reachable; `.env.example` only in repo |
| T-002 | Remove hardcoded DB creds from scripts | Config | P0 | Not Started | — | `server/check_db.mjs`, `migrate_employee_onboarding.mjs`, `seed-offboarding.js` | `grep qCIqfJ0` empty |
| T-003 | Add `tenantScope` middleware | Multi-tenant | P0 | Not Started | — | new `server/middleware/tenant.js`, `app.js` | `req.companyId` set from token; non-admin cannot override |
| T-004 | Scope all list/create queries to `req.companyId` | Multi-tenant | P0 | Not Started | — | all `server/routes/*` | Param `company_id` ignored; lists tenant-only |
| T-005 | Add `AND company_id=?` (404 on mismatch) to `:id` routes | Multi-tenant | P0 | Not Started | — | all `server/routes/*` | Cross-tenant id → 404 |
| T-006 | Guard `PUT /api/users/:id` + field whitelist | Users | P0 | Not Started | — | `server/routes/users.js` | Non-admin 403; no role/company self-change |
| T-007 | Authorize on/offboarding checklist/step/email endpoints | On/Offboarding | P0 | Not Started | — | `routes/onboarding.js`, `offboarding.js` | `employee` role 403; cross-tenant 404 |
| T-008 | Add `company_id` to `audit_logs`; scope reads; record on write | Audit | P0 | Not Started | — | `schema.sql`, migration, `routes/audit.js`, `dashboard.js`, `services/auditService.js` | Audit list tenant-only; new rows stamped |
| T-009 | Scope reports + dashboard by token tenant | Reports | P0 | Not Started | — | `routes/reports.js`, `dashboard.js` | No cross-tenant rows |
| T-010 | Fix upload filter (reject + magic bytes) | Uploads | P0 | Not Started | — | `middleware/upload.js` | `.exe`/`.html` → 400 |
| T-011 | Random admin password + forced change | Auth | P0 | Not Started | — | `schema.sql`, `setup-db.js` | No static credential; first login forces reset |
| T-012 | Whitelist table names in backup import | Backup | P0 | Not Started | — | `routes/backup.js` | Unknown table key → 400 |
| T-013 | Cross-company reveal-password lockdown + audit | Assets | P0 | Not Started | — | `routes/assets.js` | Cross-tenant reveal 404; reveal audited |
| T-014 | Soft-delete companies; block hard cascade delete | Companies | P1 | Not Started | — | `schema.sql`, `routes/companies.js` | Delete archives; data intact |
| T-015 | Write `isolation.test.js` covering all endpoints | Testing | P0 | Not Started | — | `server/tests/isolation.test.js` | Suite passes; gates CI |

## Phase 2 — Core Logic & High-Risk Security

| Task ID | Task | Module | Priority | Status | Assigned | Related file(s) | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| T-101 | Add rate limiting (login/AI/email/global) | Platform | P1 | Not Started | — | `app.js`, `routes/auth.js`,`ai.js`,`email.js` | Login 5/15min; AI/email throttled |
| T-102 | Remove TLS-verification bypass | Services | P1 | Not Started | — | `services/deepseekService.js`, `emailService.js` | No `rejectUnauthorized:false` |
| T-103 | Auth + rate-limit `parse-cv` | Recruitment | P1 | Not Started | — | `routes/candidates.js` | Anonymous → 401 |
| T-104 | Sanitize CV→LLM; clamp score | AI | P1 | Not Started | — | `services/deepseekService.js` | Injection test cannot force score; score 0–100 |
| T-105 | Remove hardcoded PII fallback | AI | P1 | Not Started | — | `services/deepseekService.js` | Parse failure returns error, no PII |
| T-106 | Implement correct EOSB engine + tests | Offboarding | P1 | Not Started | — | new `services/eosbService.js`, `routes/offboarding.js` | Unit tests match UAE examples |
| T-107 | Scope email logs/stats by company | Email | P1 | Not Started | — | `routes/email.js` | Tenant-only logs |
| T-108 | Authorize performance signing | Performance | P1 | Not Started | — | `routes/performance.js` | Only employee/manager may sign |
| T-109 | `zod` validation middleware + per-route schemas | Backend | P1 | Not Started | — | new `middleware/validate.js`, all routes | Malformed → 422 with errors |
| T-110 | Per-company email uniqueness + dup checks | DB/Backend | P1 | Not Started | — | `schema.sql`, `employees.js`,`candidates.js`,`users.js` | Dup email per company → 409 |
| T-111 | Reduce JSON limit; clamp pagination | Platform | P2 | Not Started | — | `app.js`, list routes | `limit≤100`; body ≤5MB |
| T-112 | JWT to httpOnly cookie or short token+refresh | Auth | P2 | Not Started | — | `routes/auth.js`, `middleware/auth.js`, client `authSlice.js`, `axios.js` | Token not in localStorage; refresh works |

## Phase 3 — Database & API

| Task ID | Task | Module | Priority | Status | Assigned | Related file(s) | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| T-201 | Adopt migration framework; baseline; remove ad-hoc runners | DB ops | P1 | Not Started | — | `db/migrations/`, delete legacy scripts | up/down clean in CI |
| T-202 | Roles/permissions tables + permission RBAC | Auth/DB | P1 | Not Started | — | `schema.sql`, `middleware/rbac.js`, routes | Per-action checks enforced |
| T-203 | Composite indexes | DB | P2 | Not Started | — | migration | EXPLAIN uses index |
| T-204 | SLA columns → INT hours | DB | P2 | Not Started | — | `schema.sql`, on/offboarding | Breach computable |
| T-205 | `asset_inventory` unique per company | DB | P2 | Not Started | — | migration | No cross-tenant code collision |
| T-206 | Company-scope shared config (copy-on-write) | Settings | P2 | Not Started | — | `schema.sql`, `settings.js`,`legal.js`,`kpi.js` | Edits isolated per tenant |
| T-207 | Standard soft-delete + default scope | DB | P2 | Not Started | — | schema + routes | Deletes recoverable |
| T-208 | Stage history ON DELETE RESTRICT | DB | P3 | Not Started | — | `schema.sql` | History preserved |
| T-209 | NOT NULL backfills + checked_by + seniority unique | DB | P3 | Not Started | — | schema + routes | Constraints applied |
| T-210 | Employee change-history table | Employees | P2 | Not Started | — | `schema.sql`, `routes/employees.js` | Every change logged |
| T-211 | Move file blobs to object storage + signed URLs | Documents | P2 | Not Started | — | `documents.js`,`candidates.js`, storage svc | Files served via signed URL |
| T-212 | Central error envelope + secret-stripping serializer | Backend | P2 | Not Started | — | new `middleware/errorHandler.js` | Uniform errors; no secret leakage |

## Phase 4 — UI/UX

| Task ID | Task | Module | Priority | Status | Assigned | Related file(s) | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| T-301 | Remove mock work-history/salary fallbacks | Recruitment UI | P1 | Not Started | — | `pages/recruitment/Candidates.jsx` | Empty state instead of fake data |
| T-302 | Reset modal state between records | Recruitment UI | P2 | Not Started | — | `Candidates.jsx` | No stale data on reopen |
| T-303 | Wire or hide Topbar search + bell | Shell | P2 | Not Started | — | `components/partials/Topbar.jsx` | No dead controls |
| T-304 | `allowedRoles` on ProtectedRoute | Auth UI | P1 | Not Started | — | `components/shared/ProtectedRoute.jsx` | Forbidden route redirects |
| T-305 | Sanitize dangerouslySetInnerHTML | UI security | P2 | Not Started | — | `Inventory.jsx`,`OrgChart.jsx`,`Assets.jsx` | Output sanitized |
| T-306 | react-hook-form+zod + central client errors | Forms | P2 | Not Started | — | `api/*`, form components | Consistent validation/UX |
| T-307 | Strip debug logging; env API URL | Build | P3 | Not Started | — | `vite.config.js`,`axios.js`, pages | No console.* in bundle |
| T-308 | Accessibility pass | UI | P3 | Not Started | — | components | axe: no critical issues |
| T-309 | Localize remaining strings + templates | i18n | P3 | Not Started | — | `Sidebar.jsx`,`emailTemplates.js`, locales | All strings via t() |

## Phase 5 — Performance

| Task ID | Task | Module | Priority | Status | Assigned | Related file(s) | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| T-401 | Cache dashboard/report stats per company | Reports | P2 | Not Started | — | `routes/dashboard.js`,`reports.js` | p95 < 500ms at scale |
| T-402 | Async email queue + retry | Email | P2 | Not Started | — | `services/emailService.js`, worker | Bulk returns job id |
| T-403 | Stream files; object storage | Documents | P2 | Not Started | — | upload/download routes | Bounded memory |
| T-404 | Load test + verify indexes | Perf | P2 | Not Started | — | perf tests | Targets met |
| T-405 | Clustering / pool tuning | Deploy | P3 | Not Started | — | deployment config | Multi-core utilization |

## Phase 6 — Features (see 09_FEATURE_ENHANCEMENT_PLAN.md)

| Task ID | Task | Module | Priority | Status | Assigned | Related file(s) | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| T-501 | Attendance module (F-01) | Attendance | P1 | Not Started | — | new module + tables | Tenant-scoped, tested |
| T-502 | Leave management + approvals (F-02/F-04) | Leave | P1 | Not Started | — | new module + tables | Accrual + approval verified |
| T-503 | Payroll engine + payslips (F-03) | Payroll | P1 | Not Started | — | new module + tables | Finance-verified runs |
| T-504 | Approval workflow engine (F-04) | Workflow | P1 | Not Started | — | new module | Chains/delegation work |
| T-505 | In-app notifications (F-08) | Notifications | P2 | Not Started | — | new module | Bell shows real data |
| T-506 | Contract lifecycle + expiry (F-05/F-09) | Contracts | P2 | Not Started | — | new module | Reminders fire |
| T-507 | Performance review cycles (F-13) | Performance | P2 | Not Started | — | extend module | Cycle + actuals |
| T-508 | Expanded ESS portal (F-06) | Portal | P2 | Not Started | — | `routes/portal.js`, client | Payslip/leave/docs visible |
| T-509 | ATS interviews/offers (WF-007) | Recruitment | P2 | Not Started | — | extend recruitment | Scheduling + offers |
| T-510 | HR analytics dashboard (F-07) | Analytics | P3 | Not Started | — | extend reports | KPIs + export |

## Phase 7 — Testing & Deployment

| Task ID | Task | Module | Priority | Status | Assigned | Related file(s) | Acceptance criteria |
|---|---|---|---|---|---|---|---|
| T-601 | Unit tests (services) | Testing | P1 | Not Started | — | `server/tests/unit/*` | ≥80% on services |
| T-602 | Integration tests per module | Testing | P1 | Not Started | — | `server/tests/integration/*` | Core paths covered |
| T-603 | Security tests (authz/IDOR/injection/upload) | Testing | P1 | Not Started | — | `server/tests/security/*` | All pass |
| T-604 | E2E happy paths | Testing | P2 | Not Started | — | `e2e/*` | Key journeys green |
| T-605 | CI pipeline w/ isolation+security gates | DevOps | P1 | Not Started | — | CI config | Blocking on failure |
| T-606 | Staging deploy + UAT | Deploy | P1 | Not Started | — | `10_...md` | Sign-off |
| T-607 | Production deploy + monitoring | Deploy | P1 | Not Started | — | `10_...md` | Post-deploy checklist passes |

---

**Totals:** 15 (P1 security) + 12 + 12 + 9 + 5 + 10 + 7 = **70 tracked tasks**. Keep this file updated as the single source of truth; reconcile with `docs/PROGRESS_TRACKER.md` (CQ-012) or retire that file.
