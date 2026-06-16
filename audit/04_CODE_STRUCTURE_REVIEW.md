# 04 — Code Structure & Architecture Review

**Audit date:** 2026-06-11

---

## 1. Current Code Structure

```
IST_HR_System/
├─ .env                      # secrets committed (SEC-001)
├─ IST_HR_System 3.html      # 902 KB legacy single-file SPA (dead)
├─ Mert Sadek CV .pdf        # stray artifact
├─ uploads/                  # asset_images, cvs, employee_docs, handover_receipts
├─ scratch/                  # working files
├─ docs/                     # planning + module + phase docs (some drift)
├─ server/
│  ├─ app.js                 # express app, mounts 28 routers
│  ├─ server.js              # bootstrap
│  ├─ config/db.js           # mysql2 pool
│  ├─ middleware/            # auth.js, rbac.js, upload.js
│  ├─ routes/                # 28 route modules (raw SQL)
│  ├─ services/              # audit, crypto, email, deepseek, barcode, cvParser
│  ├─ migrations/            # 2 .sql files
│  ├─ tests/                 # api.test.js, e2e.test.js
│  └─ *.mjs / *.js scripts   # setup-db, migrate*, check_db, seed-*, run_full_scenario
└─ client/
   └─ src/
      ├─ pages/      (33)    # dashboard, auth, recruitment, lifecycle, legal, analytics, admin, settings
      ├─ components/ (13)    # ui/, partials/, shared/, email/
      ├─ api/        (23)    # axios wrapper + per-domain modules
      ├─ store/             # Redux Toolkit: auth, entity, companies slices
      ├─ layout/            # MainLayout
      ├─ utils/             # cn.js, confirm.js
      └─ locales/           # en.json, ar.json (i18next + RTL)
```

**Overall:** sensible, conventional separation (routes / services / middleware on the server; pages / components / api / store on the client). The problems are not the top-level layout but consistency, validation, and a few large/dead modules.

## 2. Problems in Structure

| # | Problem | Location | Severity |
|---|---|---|---|
| 1 | Dead route never mounted | `server/routes/employees_additions.js` (not in `app.js`) | Low (CQ-001) |
| 2 | Legacy/stray artifacts in repo | `IST_HR_System 3.html`, `Mert Sadek CV .pdf`, `scratch/` | Low (CQ-002) |
| 3 | Multiple one-off DB scripts with hardcoded creds, no framework | `migrate.js`, `run_migration.cjs`, `migrate_employee_onboarding.mjs`, `check_db.mjs`, `seed-*.js` | High (DB-005, SEC-002) |
| 4 | No validation layer; logic + validation + SQL mixed in handlers | all `routes/*` | High (API-001) |
| 5 | Monolithic page components | `Candidates.jsx` 807, `Inventory.jsx` ~900, `Assets.jsx` ~800 | Medium (UI-004) |
| 6 | Two overlapping asset domains | `assets.js`/`asset_assignments` vs `inventory.js`/`asset_inventory` | High (WF-003) |
| 7 | No shared error/response envelope | server + client | Medium (API-003) |
| 8 | Hardcoded config (roles, currencies, colors, URLs) | `CompanySettings.jsx`, `UserManagement.jsx`, `vite.config.js`, `axios.js` | Low (CQ-004, CQ-011) |
| 9 | Inconsistent client error handling (toast vs silent catch) | `onboardingApi.js`, `departmentsApi.js` vs others | Medium (API-003) |
| 10 | Mixed module systems in scripts (`.js` ESM, `.cjs`, `.mjs`) | server root | Low |
| 11 | Documentation drift | `docs/PROGRESS_TRACKER.md` (100%) vs `PHASE_10_MISSING_FEATURES.md` (28 gaps) | Low (CQ-012) |

## 3. Duplicate / Overlapping Code

- **Asset management** split across two route files + two tables with manual count syncing (WF-003) — the largest structural duplication.
- **CRUD scaffolding** (list+filter+paginate, create, getById, update, delete, audit) is hand-rewritten in every route with subtle differences (some scope by company, some don't — which is exactly how TEN-001/002 crept in). A shared `crudFactory(table, schema, options)` would both de-duplicate and **enforce tenant scoping by construction**.
- **Form state + manual validation** repeated across pages instead of a shared form hook with `zod` resolver (the installed `react-hook-form`+`yup` are barely used — CQ-006).
- **AI fallback data** duplicated/hardcoded (`deepseekService.js` PII profile, `Candidates.jsx` mock history/salary) — SEC-009, UI-001.

## 4. Bad Patterns

- **Trusting client for tenant** (the root cause of the Critical isolation findings).
- **`cb(null, true)` "allow all for now"** in the upload filter — a TODO shipped as production behavior.
- **`rejectUnauthorized: false`** to disable TLS verification for external calls.
- **Hardcoded secrets and credentials** in `.env` and scripts.
- **Hard deletes with cascade** instead of soft-delete + archive.
- **Silent `catch {}`** swallowing API errors on the client.
- **`dangerouslySetInnerHTML`** with record-derived data (print receipts).
- **SLA as free-text VARCHAR** — data that needs arithmetic stored as prose.

## 5. Suggested Folder Structure

Server (introduce validation + controllers/services split):
```
server/src/
├─ app.js
├─ config/            # db, env (validated), constants
├─ middleware/        # auth, tenant (NEW), rbac (permission-based), validate (NEW), upload, rateLimit (NEW), errorHandler (NEW)
├─ modules/           # feature-first; each owns route+controller+service+schema
│  ├─ employees/{routes,controller,service,schema}.js
│  ├─ candidates/...
│  ├─ attendance/...  # NEW
│  ├─ leave/...       # NEW
│  └─ payroll/...     # NEW
├─ services/          # cross-cutting: crypto, email, ai, audit, eosb (NEW)
├─ db/
│  ├─ migrations/     # knex/flyway, versioned
│  └─ seeds/
└─ tests/             # unit, integration, isolation, security
```
Client:
```
client/src/
├─ pages/<domain>/    # thin: compose feature components
├─ features/<domain>/ # NEW: hooks, components, slice for each domain
├─ components/ui/     # design system (keep)
├─ api/               # keep per-domain; add typed error envelope
├─ store/
├─ lib/               # axios, validation schemas (shared with server where possible), i18n
└─ config/            # env-driven constants
```

## 6. Suggested Naming Conventions

- Files: `camelCase.js` for modules, `PascalCase.jsx` for React components (already mostly followed).
- Routes: REST nouns, plural (`/api/leave-requests`), kebab-case paths.
- DB: `snake_case` tables/columns (already followed); booleans `is_*`; timestamps `*_at`; FKs `<entity>_id`.
- Permissions: `resource.action` (`employees.delete`, `payroll.approve`).
- Avoid suffix files like `employees_additions.js`; merge into the domain module.

## 7. Suggested Component Structure (frontend)

Split each >500-line page into:
- `XxxPage.jsx` — data fetching + layout only.
- `XxxTable.jsx` / `XxxFilters.jsx` — list + filters.
- `XxxFormModal.jsx` — create/edit, `react-hook-form` + `zod` resolver, state reset on open keyed by record id (fixes UI-006).
- `XxxDetailDrawer.jsx` — profile/detail (e.g. candidate AI tabs).
Shared: a `useCrud(api)` hook for list/create/update/delete with toast + optimistic states; an `<ConfirmDelete>` wrapper (SweetAlert2 already present).

## 8. Suggested API/Service Structure (backend)

- **Controller** (HTTP in/out) → **Service** (business logic, transactions) → **DB** (parameterized SQL). Keeps EOSB, hire-transaction, asset assign/return logic testable in isolation.
- **`validate(schema)`** middleware runs before controllers; returns `422 { errors: [...] }`.
- **`crudFactory`** generating tenant-scoped CRUD so isolation is the default, not per-route discipline.
- **Central error handler** mapping known error types to status + safe message; never leak stack traces.
- **`eosbService`**, **`attendanceService`**, **`leaveService`**, **`payrollService`** as pure, unit-tested modules.

## 9. Refactoring Roadmap

| Stage | Work | Depends on | Outcome |
|---|---|---|---|
| R0 | Delete dead code/artifacts (`employees_additions.js`, legacy HTML, scratch); strip debug logging; env-driven frontend URL | — | Clean baseline (CQ-001/002/003/011) |
| R1 | Add `tenantScope`, `validate(zod)`, `rateLimit`, central `errorHandler` middleware; wire into all routers | Security Phase 1 | Isolation + validation + DoS protection by construction |
| R2 | Introduce migration framework; baseline schema; remove ad-hoc runners | DB-005 | Repeatable, reversible schema changes |
| R3 | Extract services (eosb, hire, asset) from routes; add unit tests | R1 | Testable business logic; fixes WF-001 |
| R4 | Unify asset domains behind `asset_inventory`; transactional assign/return | WF-003 | Single source of truth |
| R5 | `crudFactory` + per-domain refactor; split monolithic pages | R1–R3 | De-duplication, reviewability (UI-004) |
| R6 | Roles/permissions model + permission-based RBAC | DB-003 | Extensible authorization |
| R7 | Adopt `react-hook-form`+`zod` forms consistently; central client error envelope | R5 | Consistent UX/validation (API-003, CQ-006) |

Each stage is independently shippable and ordered so security fixes (R1) land before cosmetic refactors (R5–R7).
