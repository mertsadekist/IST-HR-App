# 03 — Multi-Company Architecture Review

**Audit date:** 2026-06-11
**Tenancy model:** Shared database, shared schema, `company_id` discriminator column.

---

## 1. Current Multi-Company Implementation

- **Token:** login issues a JWT containing `{ id, name, role, company_id }` (`routes/auth.js:35`). This is the authoritative tenant identity — but routes ignore it for scoping.
- **Schema:** ~33 of 45 tables carry `company_id` with FK to `companies(id) ON DELETE CASCADE` and a single-column index. `users.company_id` is nullable (`ON DELETE SET NULL`) for platform-level admins.
- **Frontend:** a Sidebar "entity switcher" (`Sidebar.jsx:191-222`) sets `currentCompany` in Redux; pages append it as a `company_id` **query parameter** to API calls; an "ALL" option sends no parameter.
- **Backend:** routes read `company_id` from `req.query`/`req.body` (or omit filtering), **not** from `req.user`.

**Net effect:** the database is multi-tenant-capable, but the application behaves as a single trust domain where the client declares which tenant it wants.

## 2. Problems Found

| # | Problem | Evidence | Severity |
|---|---|---|---|
| P1 | Tenant chosen by client, not token | TEN-001, TEN-004, TEN-005 | Critical |
| P2 | Per-record access unscoped (IDOR) | TEN-002, TEN-006 | Critical |
| P3 | Audit log has no tenant column | TEN-003 | Critical |
| P4 | Shared global config tables | TEN-010 (`ats_stages`, `letter_templates`, `kpi_tiers`, `kpi_targets`, `platform_catalog`) | High |
| P5 | Logs/stats not scoped | TEN-009 (email), dashboard activity | High |
| P6 | No `super_admin` vs `company_admin` distinction | DB-003 | High |
| P7 | Company delete cascades all tenant data | DB-001 | Critical |
| P8 | `asset_code` / sequences unique globally, leaking other tenants | DB-008 | Medium |
| P9 | No automated test proving isolation | — | High |

## 3. Data-Isolation Risks (concrete)

- **Read:** `GET /api/employees?company_id=2`, `GET /api/documents/3/download`, `GET /api/assets/7/reveal-password`, `GET /api/audit`, `GET /api/reports/employees` all return other tenants' data to any logged-in user.
- **Write:** `POST /api/candidates` / `POST /api/assets` with another `company_id` plant records in a foreign tenant; `PUT /api/employees/:id` edits foreign employees; `PUT /api/users/:id` moves the attacker into another tenant and elevates role.
- **Destroy:** `DELETE /api/employees/:id`, `DELETE /api/documents/:id`, `DELETE /api/companies/:id` (cascade) across tenants.
- **Config poisoning:** editing an ATS stage / letter template / KPI tier changes it for every company.

## 4. Required Database Changes

```sql
-- 4.1 Tenant column on audit log (TEN-003)
ALTER TABLE audit_logs ADD COLUMN company_id INT NULL AFTER user_id;
UPDATE audit_logs a JOIN users u ON a.user_id = u.id SET a.company_id = u.company_id;
ALTER TABLE audit_logs ADD INDEX idx_audit_company (company_id, created_at);

-- 4.2 Company-scope the shared config tables (TEN-010). NULL company_id = global default.
ALTER TABLE ats_stages       ADD COLUMN company_id INT NULL, ADD INDEX (company_id);
ALTER TABLE letter_templates ADD COLUMN company_id INT NULL, ADD INDEX (company_id);
ALTER TABLE kpi_tiers        ADD COLUMN company_id INT NULL, ADD INDEX (company_id);
ALTER TABLE kpi_targets      ADD COLUMN company_id INT NULL, ADD INDEX (company_id);
-- platform_catalog already bridged via platform_companies; verify reads go through the junction.

-- 4.3 Per-tenant uniqueness instead of global (DB-004, DB-008)
ALTER TABLE employees  ADD CONSTRAINT uq_emp_email  UNIQUE (company_id, email);
ALTER TABLE candidates ADD CONSTRAINT uq_cand_email UNIQUE (company_id, email);
ALTER TABLE asset_inventory DROP INDEX asset_code, ADD UNIQUE (company_id, asset_code);

-- 4.4 Composite indexes for tenant-scoped filters (DB-006)
ALTER TABLE candidates          ADD INDEX idx_cand_co_status (company_id, status);
ALTER TABLE employees           ADD INDEX idx_emp_co_status  (company_id, status);
ALTER TABLE onboarding_records  ADD INDEX idx_onb_co_status  (company_id, status);
ALTER TABLE offboarding_records ADD INDEX idx_off_co_status  (company_id, status);
ALTER TABLE asset_assignments   ADD INDEX idx_asg_co_status  (company_id, status);

-- 4.5 Soft delete for companies (DB-001) — replace cascade-on-delete with archive
ALTER TABLE companies ADD COLUMN deleted_at TIMESTAMP NULL;
```

Future (Phase 2+): roles/permissions tables scoped by company (DB-003) — see `01_FULL_AUDIT_REPORT.md` DB-003.

## 5. Required Backend Changes

1. **`tenantScope` middleware** (new `middleware/tenant.js`), applied after `auth` on every data router:
   ```js
   export const tenantScope = (req, res, next) => {
     // platform admins may target another tenant explicitly; everyone else is pinned
     if (req.user.role === 'super_admin' && req.query.company_id) {
       req.companyId = Number(req.query.company_id);
     } else {
       req.companyId = req.user.company_id;
     }
     if (!req.companyId && req.user.role !== 'super_admin') {
       return res.status(403).json({ error: 'No company context' });
     }
     next();
   };
   ```
2. **Rewrite every query** to use `req.companyId` (never `req.query.company_id`) for both reads and writes.
3. **Per-record ownership:** every `:id` read/update/delete includes `AND company_id = ?` and returns 404 on no-match.
4. **Helper** to standardize: `const ownRow = (table, id, companyId) => pool.query(\`SELECT * FROM ?? WHERE id=? AND company_id=?\`, [table, id, companyId])` — but prefer explicit per-route SQL to keep the parameterization auditable.
5. **Audit:** `addAudit(pool, user, module, action, detail)` extended to persist `user.company_id`.
6. **Copy-on-write config:** when a company edits a global template/stage/tier, clone the row with its `company_id`; reads use `WHERE company_id IN (?, NULL) ORDER BY company_id DESC LIMIT 1` semantics (prefer own over global).
7. **Role split:** introduce `super_admin` (platform) and `company_admin` (tenant). `GET /api/companies` returns all only for `super_admin`; a `company_admin` sees only their own.

## 6. Best-Practice Query Patterns

**Before (broken):**
```js
// candidates.js — trusts client
let sql = 'SELECT * FROM candidates WHERE 1=1';
const params = [];
if (req.query.company_id) { sql += ' AND company_id=?'; params.push(req.query.company_id); }
```
**After (token-scoped):**
```js
const params = [req.companyId];
let sql = 'SELECT * FROM candidates WHERE company_id = ?';
if (req.query.status) { sql += ' AND status = ?'; params.push(req.query.status); }
sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
params.push(Math.min(+req.query.limit || 50, 100), offset);
```
**Per-record (IDOR-safe):**
```js
const [[row]] = await pool.query(
  'SELECT * FROM employees WHERE id = ? AND company_id = ?',
  [req.params.id, req.companyId]
);
if (!row) return res.status(404).json({ error: 'Not found' });
```
**Insert (server-set tenant):**
```js
await pool.query(
  'INSERT INTO candidates (company_id, first_name, last_name, email) VALUES (?,?,?,?)',
  [req.companyId, first_name, last_name, email]   // never trust body.company_id
);
```

### Defense-in-depth option (recommended longer term)
For a system holding payroll/PII, consider MySQL **row-level isolation via a session variable + views**, or a thin data-access layer that refuses any query lacking a `company_id` predicate (a lint/test that greps routes for `pool.query` without a tenant param). At minimum, add a CI test that fails if a new route omits `tenantScope`.

## 7. Recommended Tenant Architecture (target state)

- **Keep shared-schema** (cost-effective for this scale) but enforce isolation in code, not the client.
- **Identity:** tenant is always `req.user.company_id`; only `super_admin` may cross, explicitly and audibly.
- **Config:** two-tier (global defaults + per-company overrides via copy-on-write).
- **Roles:** `super_admin` (platform), `company_admin`, `hr_manager`, `recruiter`, `employee`, expressed through a permissions table scoped by company.
- **Files:** object storage prefixed by `company_id/`, served via signed URLs validated against the caller's tenant.
- **Audit:** every row tenant-stamped; per-company audit export.
- **Deletion:** soft-delete tenants; hard purge only via an offline, backed-up, super-admin job.

## 8. Required Frontend Changes

- Stop sending `company_id` as a query parameter from normal pages (the server derives it). Keep the entity switcher **only** for `super_admin`, where it sets a header (e.g. `X-Company-Id`) the server validates.
- Add `allowedRoles` to `ProtectedRoute` (defense-in-depth) and hide the "ALL" view for non-super-admins.
- Treat all role-based UI as cosmetic; never assume it is a security control.

## 9. Testing Checklist for Company Isolation

Seed two companies (A, B) with users at each role. For **every** data endpoint, assert:

- [ ] User A listing returns only company A rows; no `company_id` param can widen it.
- [ ] User A GET/PUT/DELETE on a company B record id → **404**.
- [ ] User A POST cannot create a record under company B (body `company_id` ignored).
- [ ] `GET /api/audit`, `/api/email/log`, `/api/reports/*`, `/api/dashboard/*` return only company A data.
- [ ] `GET /api/assets/:id/reveal-password` for a B asset → 404; reveal is audit-logged.
- [ ] Editing a letter template / ATS stage / KPI tier in A does not change B's.
- [ ] `company_admin` of A cannot list companies; `super_admin` can, and crossing tenants is audit-logged.
- [ ] `PUT /api/users/:id` cannot change role/company for non-admins; cannot self-elevate.
- [ ] `DELETE /api/companies/:id` archives, does not cascade-destroy.
- [ ] Regression: a newly added route without `tenantScope` fails a CI guard test.

Automate as `server/tests/isolation.test.js`; run in CI on every PR (see `08_TESTING_PLAN.md` §7).
