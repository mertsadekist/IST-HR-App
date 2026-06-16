# Phase 1 Implementation — Critical Security & Data Isolation

**Implemented:** 2026-06-11 · **Status:** code complete, syntax-checked, booted against the live DB, migration applied, smoke-tested.

This records exactly what was changed for Phase 1 of `06_BUG_FIXING_PLAN.md`. Finding IDs reference `01_FULL_AUDIT_REPORT.md`.

---

## What was implemented

### Tenant isolation foundation (TEN-001/002/004/005/006/007/009, DB-006)
- **New `server/middleware/tenant.js`** — `tenantScope` derives the company from the JWT (`req.companyId`), never from client query/body. A user is treated as a *platform admin* only when role is `admin` **and** `company_id` is null; any company-bound admin is pinned to their own company. Helpers `companyClause(req, col)` and `resolveWriteCompanyId(req, body)` make scoping uniform.
- **Applied `router.use(auth, tenantScope)`** and rewrote queries to scope by `req.companyId` (mandatory, not optional) across: `employees`, `candidates`, `vacancies`, `documents`, `assets`, `inventory`, `legal`, `performance`, `kpi`, `reports`, `dashboard`, `audit`, `email`, `onboarding`, `offboarding`, `companies`, `departments`, `ai`, `cvScorer`.
- **IDOR closed:** every `:id` read/update/delete now appends `AND company_id = ?` (or verifies ownership) and returns **404** on cross-company access. Includes the critical `GET /api/assets/:id/reveal-password` (TEN-006).
- **Nested-resource authz (TEN-007):** onboarding/offboarding checklist-toggle and step-complete endpoints now require `admin`/`hr_manager`(/`hr_specialist`) and verify the parent record's company by joining up the chain.

### Audit log tenancy (TEN-003)
- `audit_logs.company_id` column added (schema + live migration + backfill from `users`), indexed `idx_audit_company`. `addAudit()` now persists it; `/api/audit` and dashboard activity are company-scoped.

### Privilege escalation (SEC-005)
- `PUT /api/users/:id` rewritten: field whitelist (no direct `password_hash`/arbitrary columns), role validated against an allowlist, self role-change blocked, company-bound admins cannot mint platform admins, and the target user is resolved within the caller's company scope. `POST`, toggle, and delete are likewise company-scoped. bcrypt cost raised to 12.

### File upload hardening (SEC-004)
- `middleware/upload.js` now **rejects** non-allowlisted mime types (was `cb(null,true)` for everything). `app.js` global error handler maps Multer/upload/oversize/bad-JSON errors to 400/413 instead of 500.

### Backup import (SEC-006)
- `routes/backup.js` validates every table name from the request body against a hardcoded whitelist before interpolation; unknown tables are rejected.

### Company lifecycle (DB-001)
- `companies.deleted_at` added; `DELETE /api/companies/:id` now **soft-deletes** (platform-admin only) instead of cascade-wiping a tenant. List/detail exclude soft-deleted rows.

### Secrets, AI, TLS (SEC-001/002/007/008/009/012, SEC-010/016)
- Removed hardcoded DB credentials from `check_db.mjs`, `migrate_employee_onboarding.mjs`, `test_cv_parsing.js` (now import the shared pool from `config/db.js`).
- `cryptoService.getKey()` now **throws** if `ENCRYPTION_KEY` is missing (no more silent fallback to the JWT secret / `'default-key'`).
- DeepSeek and SMTP TLS verification restored (`rejectUnauthorized` honoured; only disablable via explicit `ALLOW_INSECURE_TLS=true` in non-production).
- CV/document text sent to the LLM is sanitized and delimited as untrusted data with anti-injection instructions; `analyzeCV` clamps the returned score to 0–100.
- Removed the hardcoded real-person PII fallback in `deepseekService.parseEmployeeDocument`; salary is no longer fabricated (returns null when not stated).
- Default admin seed removed from `schema.sql`; `setup-db.js` now generates a random initial admin password (or uses `ADMIN_INITIAL_PASSWORD`) and prints it once.
- New **dependency-free** `middleware/rateLimit.js` wired in `app.js`: global 300/min, login 10/15min, AI 30/min, cv-scorer 30/min, email 60/min. JSON body limit reduced 50mb → 2mb.
- Added `.env.example`; `parse-cv` now requires auth + recruiter role (SEC-013).

### Files added
`server/middleware/tenant.js`, `server/middleware/rateLimit.js`, `server/migrations/phase1_security.sql`, `server/apply_phase1.mjs` (idempotent runner), `.env.example`.

---

## Verification performed
- `node --check` passes on all 34 modified server files.
- Server boots, connects to MySQL, `/api/health` OK.
- `POST /api/auth/login` validates input and issues a token; login is audited with the new `company_id` column (no insert error).
- `GET /api/employees` and `GET /api/audit` return scoped data through `tenantScope`.
- Phase 1 DB migration applied idempotently to the live database (audit column + backfill + composite indexes + `companies.deleted_at`).

---

## ⚠️ Operator actions still required (cannot be done from code)
1. **Rotate every secret** in `.env` (DB password, `JWT_SECRET`, `DEEPSEEK_API_KEY`, `ENCRYPTION_KEY`) — they were committed and must be considered compromised. Note: rotating `ENCRYPTION_KEY` requires re-encrypting stored credentials.
2. **Firewall the MySQL host** (`147.93.27.94:5458`) off the public internet / IP-allowlist.
3. **Change the existing `admin` account password** — the live DB still has the historical `admin123`. The seed fix only affects fresh installs. Reset it via the app or a one-off hashed update.
4. **Scrub the DB password** still present in `docs/phases/phase_0_foundation.md`, `docs/architecture/overview.md`, and `scratch/test_parsing.js` (left untouched — docs/scratch).

## Deferred to later phases (per plan)
- Full `zod` validation layer (Phase 2, API-001), correct EOSB engine (Phase 2, WF-001), httpOnly-cookie/refresh tokens (Phase 2, SEC-011/015), roles/permissions model (Phase 3, DB-003), per-company config tables for `ats_stages`/`letter_templates`/`kpi_*` (Phase 3, TEN-010), migration framework (Phase 3, DB-005), object-storage for file blobs (Phase 3, DB-009), and the automated isolation test suite (Phase 7, `08_TESTING_PLAN.md` §7).
