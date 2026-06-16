# 02 — Security Audit

**Audit date:** 2026-06-11
**Scope:** Authentication, authorization, multi-company isolation, input validation, file upload, API surface, sensitive-data handling, secrets management.
**Verdict:** 🔴 **Not safe for production** with more than one company or any untrusted user, until all Critical and High items below are remediated.

Cross-reference IDs map to `01_FULL_AUDIT_REPORT.md`.

---

## 1. Authentication Review

**Implementation:** JWT (HS256) issued at `routes/auth.js:35`, verified in `middleware/auth.js`. Passwords hashed with bcryptjs (cost 10). `is_active` checked on login and `/auth/me`.

| Finding | ID | Severity |
|---|---|---|
| Default `admin/admin123` seeded and documented | SEC-003 | Critical |
| `JWT_SECRET` weak, plaintext in `.env`, in repo | SEC-001 | Critical |
| No rate limiting on login → brute force | SEC-010 | High |
| 24 h token, no revocation/refresh; demote/disable not enforced on data routes | SEC-015 | High |
| Token in localStorage (XSS-exfiltratable) | SEC-011 | High |
| bcrypt cost 10 (recommend ≥12) | CQ-007 | Low |
| No password complexity policy / lockout / MFA | — | High (gap) |

**What works:** bcrypt comparison is correct and timing-safe; generic "Invalid credentials" message avoids user enumeration; SQL is parameterized.

**Fixes:** rotate `JWT_SECRET`; random per-install admin password + forced change; `express-rate-limit` on login; short access token + refresh rotation (or per-request active/role check); httpOnly cookie storage + CSRF token; add password policy and account lockout; offer optional TOTP MFA for admin/hr_manager.

---

## 2. Authorization Review

**Implementation:** `authorize(...roles)` (`middleware/rbac.js`) checks `req.user.role` against an allowlist. There is **no permission model and no company scoping** in the authorization layer.

| Finding | ID | Severity |
|---|---|---|
| `PUT /api/users/:id` has no role guard → self-promotion to admin | SEC-005 | Critical |
| On/offboarding checklist & step endpoints have no role guard | TEN-007 | Critical |
| Performance signing has no guard | TEN-008 | High |
| Backup import writes arbitrary tables (admin) | SEC-006 | Critical |
| Frontend role checks are cosmetic; URLs reachable directly | SEC-014 | High |
| No `roles`/`permissions` tables; ENUM only; no `super_admin` vs `company_admin` split | DB-003 | High |

**Target model:** permission-based authorization (`authorize('employees.delete')`) backed by `roles`/`permissions`/`role_permissions`/`user_roles(company_id)`. Distinguish a platform `super_admin` (may cross companies) from a `company_admin` (scoped). Every mutating route gets an explicit permission requirement; default-deny.

---

## 3. Multi-Company Isolation Review (most critical area)

The system uses a shared-schema, `company_id`-discriminator model. **Isolation is enforced nowhere on the server** — it relies on the client to send the right `company_id`, which is fully spoofable.

### Failure classes
1. **Parameter-trusted tenant** (TEN-001, TEN-004, TEN-005): `company_id` read from query/body. → swap the value, read/write any tenant.
2. **IDOR** (TEN-002, TEN-006): `WHERE id=?` with no company clause. → enumerate IDs across tenants; includes `reveal-password` and document download.
3. **No tenant column** (TEN-003): `audit_logs`. → all events readable by anyone.
4. **Shared config tables** (TEN-010): `ats_stages`, `letter_templates`, `kpi_tiers/targets`, `platform_catalog`. → one tenant's edits affect all.
5. **Unscoped logs/stats** (TEN-009): email logs across companies.

### Worked exploit chain
`employee`-role user of Company A → calls `PUT /api/users/:id` (SEC-005) setting `role:'admin'` → now admin → `GET /api/companies` lists all tenants → iterate `company_id` on `/api/employees`, `/api/documents/:id/download`, `/api/assets/:id/reveal-password` → full multi-tenant data + credential exfiltration → `DELETE /api/companies/:id` (DB-001) wipes a competitor tenant.

### Required fixes
Single `tenantScope` middleware injecting `req.companyId = req.user.company_id`; every query filters by it; per-record routes add `AND company_id=?` returning 404 on mismatch; add `company_id` to `audit_logs`; copy-on-write for shared config; platform-admin override gated by `super_admin`. Detailed patterns and test matrix in `03_MULTI_COMPANY_ARCHITECTURE_REVIEW.md`.

---

## 4. Input Validation Review

| Finding | ID | Severity |
|---|---|---|
| No validation library; presence-only checks | API-001 | High |
| Unbounded pagination (`limit`) | API-002 | Medium |
| Arbitrary skill ids/proficiency, unbounded arrays in CV scorer | API-001 | High |
| No `UNIQUE(company_id,email)`; no API duplicate checks | DB-004 | High |
| Email header injection (CRLF in name/recipient) | SEC-018 | Medium |
| No magic-byte validation on uploads | SEC-004 | Critical |

**SQL injection:** queries use parameterized `?` placeholders broadly — **good**. The one identifier-interpolation risk is `backup.js` table names (SEC-006). No `ORDER BY ${}`/`LIKE '%${}%'` injection patterns were found in routes. Keep this discipline; add a lint rule against template literals in `pool.query`.

**Fix:** adopt `zod` + a `validate(schema)` middleware returning `422` with field errors; enforce server-side email/phone/date/salary/enum rules and per-company uniqueness; clamp pagination; sanitize email display names.

---

## 5. File Upload Security Review

| Finding | ID | Severity |
|---|---|---|
| Upload filter admits all types (`cb(null,true)` else branch) | SEC-004 | Critical |
| Original filename preserved (path-traversal/XSS metadata) | SEC-004 | High |
| Downloads may render inline (no `nosniff`/attachment) | SEC-004 | High |
| LONGBLOB-in-DB storage (also a perf/backup issue) | DB-009 | Medium |
| Unauthenticated `parse-cv` accepts uploads | SEC-013 | High |

**Fixes:** strict mime allowlist + `file-type` magic-byte check; generate server-side random storage names; force `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`; authenticate every upload/download and scope by company; move blobs to object storage with signed, expiring URLs; size limits per type; optional AV scan (ClamAV) for HR document stores.

---

## 6. API Security Review

| Area | Status | Notes |
|---|---|---|
| SQL injection | 🟢 Mostly safe | Parameterized; fix SEC-006 identifier interpolation |
| AuthN coverage | 🟡 | One unauthenticated endpoint (SEC-013); login unthrottled |
| AuthZ coverage | 🔴 | Multiple unguarded mutations (SEC-005, TEN-007/008) |
| Tenant scoping | 🔴 | Pervasive (TEN-001…010) |
| Rate limiting | 🔴 | None (SEC-010) |
| Body size / DoS | 🟠 | 50 MB JSON + in-memory uploads, single process (SEC-016) |
| CORS | 🟢/🟡 | Locked to localhost in dev; ensure `CLIENT_URL` set & exact in prod |
| Security headers | 🟡 | helmet on, but `crossOriginResourcePolicy:false`; add CSP, `nosniff`, HSTS at proxy |
| Error handling | 🟢 | Global handler returns generic message, no stack traces |
| TLS to third parties | 🔴 | `rejectUnauthorized:false` for DeepSeek + SMTP (SEC-007) |
| Prompt injection | 🟠 | Unsanitized CV → LLM (SEC-008) |
| Audit logging | 🟡 | Present but not tenant-scoped (TEN-003) |

---

## 7. Sensitive Data Review

| Data | Storage | Issue | ID |
|---|---|---|---|
| DB password, JWT secret, AES key, AI key | `.env` (repo) + hardcoded scripts | Plaintext, committed, on public DB | SEC-001, SEC-002 |
| Stored account passwords | AES-256-GCM in `asset_assignments` | Key fallback to JWT secret/literal; cross-company reveal | SEC-012, TEN-006 |
| Employee PII / salary | MySQL plaintext | No column encryption; broad read via TEN-* | TEN-001/002 |
| SMTP credentials | encrypted in `email_config` | Returned-to-client risk; saved unverified | SEC-019, WF-011 |
| Hardcoded real person PII | `deepseekService.js:224-305` | Leak + data corruption | SEC-009 |
| CV/employee files | LONGBLOB, no AV | Malware storage (SEC-004) | DB-009 |

**Fixes:** secret manager + rotation; mandatory distinct `ENCRYPTION_KEY`; consider application-level encryption for salary/national-id columns; central response serializer stripping secret fields; remove hardcoded PII; document data-retention & deletion (GDPR/PDPL).

---

## 8. Risk Matrix

Likelihood (ease of exploitation by an authenticated low-privilege user) × Impact.

| | Impact: Low | Impact: Medium | Impact: High | Impact: Critical |
|---|---|---|---|---|
| **Likelihood: Very High** | API-002 | UI-001, SEC-018 | SEC-013, TEN-009 | **TEN-001, TEN-002, SEC-005, SEC-001, SEC-004** |
| **Likelihood: High** | CQ-007 | SEC-017, SEC-019 | SEC-010, SEC-011, TEN-008, TEN-010 | **TEN-003, TEN-004, TEN-005, TEN-006, SEC-006** |
| **Likelihood: Medium** | — | DB-009, WF-011 | SEC-008, SEC-015, API-001 | **SEC-002, SEC-003, DB-001** |
| **Likelihood: Low** | — | DB-011 | SEC-007, SEC-012, SEC-016 | SEC-009 |

The top-right cluster (Very High likelihood × Critical impact) is reachable by any logged-in user with a browser dev console and must be fixed before any multi-tenant or external exposure.

---

## 9. Security Fixes Checklist

### Phase 1 — Immediate (this week, before any further exposure)
- [ ] Rotate DB password, `JWT_SECRET`, `DEEPSEEK_API_KEY`, `ENCRYPTION_KEY` (SEC-001)
- [ ] Firewall MySQL off the public internet / IP allowlist (SEC-001)
- [ ] Remove hardcoded credentials from `check_db.mjs`, `migrate_employee_onboarding.mjs`, `seed-offboarding.js` (SEC-002)
- [ ] Add `authorize('admin')` + field whitelist to `PUT /api/users/:id` (SEC-005)
- [ ] Replace seeded admin password with random + forced change (SEC-003)
- [ ] Fix upload filter to reject non-allowlisted types; add magic-byte check (SEC-004)
- [ ] Introduce `tenantScope` middleware; enforce `req.user.company_id` on all list/create endpoints (TEN-001, TEN-004, TEN-005)
- [ ] Add `AND company_id=?` to all `:id` endpoints; 404 on mismatch (TEN-002, TEN-006)
- [ ] Guard on/offboarding checklist/step/email endpoints (TEN-007)
- [ ] Add `company_id` to `audit_logs` and scope reads (TEN-003)

### Phase 2 — High (next 1–2 sprints)
- [ ] `express-rate-limit` on login, AI, email, and globally (SEC-010, SEC-016)
- [ ] Remove `rejectUnauthorized:false` from DeepSeek + SMTP (SEC-007)
- [ ] Authenticate + rate-limit `parse-cv` (SEC-013)
- [ ] Sanitize CV text into LLM; clamp returned scores (SEC-008)
- [ ] Remove hardcoded PII fallback (SEC-009)
- [ ] Whitelist table names in backup import (SEC-006)
- [ ] Scope email logs/stats by company (TEN-009)
- [ ] Performance signing authorization (TEN-008)
- [ ] `zod` validation layer on all write endpoints (API-001)
- [ ] Per-company email uniqueness + duplicate checks (DB-004)
- [ ] Soft-delete companies; block hard cascade delete (DB-001)
- [ ] Roles/permissions model + backend RBAC on every mutation (DB-003, SEC-014)
- [ ] httpOnly cookie + CSRF, or short token + refresh (SEC-011, SEC-015)

### Phase 3 — Medium / hardening
- [ ] Reduce JSON body limit; stream uploads (SEC-016)
- [ ] Move file storage to object store + signed URLs; force attachment + nosniff (DB-009, SEC-004)
- [ ] Sanitize `dangerouslySetInnerHTML` sinks (SEC-017)
- [ ] Email header-injection guards (SEC-018)
- [ ] Central secret-stripping response serializer (SEC-019)
- [ ] Require SMTP verification before save (WF-011)
- [ ] Mandatory distinct `ENCRYPTION_KEY` at startup; key-rotation job (SEC-012)
- [ ] Clamp pagination (API-002)
- [ ] Raise bcrypt to 12 (CQ-007)
- [ ] CSP/HSTS at reverse proxy; audit-log credential reveals
- [ ] Add isolation + security test suites to CI (see `08_TESTING_PLAN.md`)
