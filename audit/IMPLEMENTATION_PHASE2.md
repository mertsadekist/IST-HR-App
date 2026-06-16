# Phase 2 Implementation — progress

**Started:** 2026-06-11 · Builds on `IMPLEMENTATION_PHASE1.md`.

## Done so far

### Automated company-isolation test suite (08 §7 — CI gate)
- **`server/tests/isolation.test.js`** — seeds two companies + per-company users/records, mints per-company JWTs, and asserts the full isolation matrix: list scoping, param can't widen scope, cross-company `:id` → 404 (employees, candidates, vacancies, document download, **asset reveal-password**, vacancy update), write scoping (POST ignores `body.company_id`), privilege-escalation blocks (employee can't self-promote or toggle checklists; company-bound admin can't delete another company's employee or create companies), audit scoping, company-list scoping, and unauthenticated rejection.
- **Result: 16/16 passing** against the live DB. Fixtures torn down in `afterAll`.

### EOSB engine (WF-001)
- **`server/services/eosbService.js`** — pure, deterministic UAE end-of-service calculator returning a full breakdown (service days/years, daily wage, gratuity days, gross, reduction factor, cap flag, eligibility reason). Rules: <1yr none; 21 days/yr first 5 years; 30 days/yr beyond; daily wage = basic/30; capped at 24 months' basic; unpaid-leave days excluded; optional legacy resignation-reduction tiers.
- **`server/tests/eosb.test.js`** — 8 unit tests (worked examples incl. <1yr, 3yr, >5yr, cap, legacy resignation, post-2022 no-reduction, unpaid leave, invalid input). **8/8 passing.**
- Wired into `routes/offboarding.js` POST — replaces the previous simplified formula and returns `eosb_breakdown` in the response.

### Validation layer foundation (API-001)
- **`server/middleware/validate.js`** — dependency-free `validate(schema)` middleware returning `422 { error, errors:[{field,message}] }`. Rule DSL: required, type (string/number/integer/email/phone/date/boolean/array), enum, min/max, minLen/maxLen, pattern. Swappable for zod later without changing call sites.
- Applied to: `POST /api/auth/login`, `POST /api/users`, `POST /api/employees`, `POST /api/candidates`.

## Verification
- Full server test suite: **53/53 passing** (api + e2e + isolation + eosb).
- All modified files pass `node --check`.

### Email hardening (SEC-018 / WF-011)
- `sendEmail` now rejects invalid recipient addresses and strips CR/LF from recipient name and subject (prevents SMTP header injection).
- `saveEmailConfig` verifies the SMTP connection before persisting when a password is supplied (`skip_verify` overrides); a failed verification throws and the config is not saved.

### Per-company email uniqueness (DB-004)
- `UNIQUE(company_id, email)` added to **candidates** (live) and to `schema.sql` for both **employees** and **candidates** (fresh installs). The live **employees** constraint is pending — `apply_phase2.mjs` detected 1 pre-existing duplicate group (`company_id=1`, the seeded test email) and refused to add the index without deleting data.
- Application-level duplicate guards return **409** on both `POST /api/employees` and `POST /api/candidates`, plus `ER_DUP_ENTRY` → 409 fallback once the DB constraint is in place.
- `server/apply_phase2.mjs` — idempotent runner that detects duplicates and only adds constraints when safe.

### Extended validation (API-001)
- `validate()` schemas added to: vacancies, departments, companies, performance, kpi-hires (in addition to auth/login, users, employees, candidates from the foundation step).

### Regression tests
- `server/tests/validation.test.js` — 5 tests covering 422 validation (login, employee email/salary, user role) and the 409 duplicate-email guard. **5/5 passing.**

## Verification (cumulative)
- Full server test suite: **58/58 passing** (api 20 + e2e 9 + isolation 16 + eosb 8 + validation 5).

## Operator follow-up
- De-duplicate the one `employees` row (`company_id=1`, `mounthir.sadek.ms@gmail.com`) then re-run `node apply_phase2.mjs` to add the `uq_emp_company_email` constraint on the live DB.

## Remaining Phase 2 items (not yet done)
- httpOnly-cookie / refresh-token auth (SEC-011/015).

## Remaining Phase 3+ (per plan)
Roles/permissions model (DB-003), per-company config tables (TEN-010), migration framework (DB-005), object-storage for file blobs (DB-009), full module build-out (attendance/leave/payroll, Phase 6).
