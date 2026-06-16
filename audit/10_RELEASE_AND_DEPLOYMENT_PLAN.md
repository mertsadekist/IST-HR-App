# 10 — Release & Deployment Plan

**Audit date:** 2026-06-11

**Gating rule:** Do not deploy to production (or expose to more than one company / any external user) until `06_BUG_FIXING_PLAN.md` Phase 1 is complete and the `08_TESTING_PLAN.md` §7 isolation suite passes in CI.

---

## 1. Pre-Deployment Checklist

**Security (blocking):**
- [ ] All secrets rotated and moved out of the repo to a secret manager (T-001/002).
- [ ] Production DB on a private network / firewalled / IP-allowlisted (not `147.93.27.94` public).
- [ ] `tenantScope` applied to every data route; isolation suite green (T-003/004/005/015).
- [ ] `PUT /api/users/:id` guarded; default admin password randomized + forced change (T-006/011).
- [ ] Upload filter restrictive; backup import table-whitelisted (T-010/012).
- [ ] Rate limiting + TLS verification restored (T-101/102).
- [ ] No `console.*` / debug logging / mock data in build (T-301/307).

**Quality:**
- [ ] CI green: lint, unit, integration, isolation, security suites.
- [ ] Migrations run cleanly up/down on a copy of production (T-201).
- [ ] `.env.example` documents every required variable; app fails fast if any missing.
- [ ] Dependency audit (`npm audit`) clean of high/critical.

## 2. Environment Configuration

Per environment (dev / staging / prod), via secret manager — never committed:

| Variable | Notes |
|---|---|
| `DB_HOST/PORT/USER/PASSWORD/NAME` | Prod on private network; least-privilege DB user (no DROP) |
| `JWT_SECRET` | ≥256-bit random, unique per env |
| `ENCRYPTION_KEY` | Distinct from JWT; 32-byte; app refuses to boot if absent (SEC-012) |
| `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL` | Rotated; usage-capped |
| `CLIENT_URL` | Exact prod origin for CORS |
| `NODE_ENV=production` | Enables prod CORS, disables verbose errors |
| `VITE_API_URL` (client) | Per-env API base (CQ-011) |
| SMTP defaults | If a global fallback transporter is used |

Frontend: build per environment (`vite build --mode production`), API base from `VITE_API_URL`.

## 3. Database Migration Plan

- Adopt a migration framework (knex/Flyway/db-migrate); baseline current schema as migration 0 (T-201).
- Order: 0 baseline → audit `company_id` (T-008) → constraints/uniqueness (T-110/209) → indexes (T-203) → config scoping (T-206) → soft-delete (T-014/207) → new-module tables (Phase 6).
- Each migration reversible (`up`/`down`); run in CI against a prod clone before release.
- Data backfills (audit company_id, dedupe emails, NOT NULL fills, blob→object-storage) run as idempotent, resumable jobs with row counts logged.
- Run migrations in a maintenance window; verify row counts and constraints post-migration.

## 4. Backup Plan

- Automated nightly full DB backup + binlog/PITR; retain ≥30 days; store off-host, encrypted.
- Take an on-demand backup immediately before every migration/deploy.
- File storage (once moved off DB): versioned object-storage bucket with lifecycle + cross-region replication.
- Test restore quarterly (restore drill into an isolated environment).

## 5. Rollback Plan

- **Code:** blue-green or tagged releases; roll back by repointing to the previous image/tag.
- **DB:** every migration has a tested `down`; for destructive migrations, take a pre-migration snapshot and prefer restore over down-migration if data changed.
- **Decision criteria:** roll back on failed post-deploy validation (§7), error-rate spike, or any isolation/authz regression detected.
- **Secrets:** keep previous secret versions available for a short overlap to avoid lockout; revoke after stabilization.

## 6. Production Testing Checklist (post-deploy smoke)

- [ ] Health endpoint OK; DB connected.
- [ ] Login (then forced password change) works; rate limit active.
- [ ] Two-company isolation spot check: company_admin A cannot see company B data.
- [ ] Create/read/update/delete one record per core module.
- [ ] File upload (allowed type) + download (attachment, nosniff).
- [ ] Email test send via configured SMTP.
- [ ] Reports/dashboard scoped to tenant.
- [ ] Audit log records the deploy-time actions with `company_id`.

## 7. Monitoring Plan

- **Uptime/health:** external check on `/api/health`; alert on failure.
- **Metrics:** request rate, p50/p95/p99 latency per route, 4xx/5xx rates, DB pool utilization, queue depth (email/payroll jobs), Node memory/CPU.
- **Alerts:** 5xx spike, latency p95 > 1s, auth-failure surge (brute force), DB connection saturation, queue backlog.
- **Security:** alert on repeated 403/404 patterns (IDOR probing), credential-reveal frequency, admin role changes.

## 8. Logging Plan

- Structured JSON logs (replace `morgan('dev')` for prod); include request id, user id, company id, route, status, latency — **never** log secrets, passwords, tokens, or full PII payloads.
- Centralize (ELK/Loki/CloudWatch); retain per policy.
- Application audit (`audit_logs`, now tenant-stamped) remains the business-event trail; separate from infra logs.
- Error tracking (Sentry or equivalent) for stack traces server-side only (clients still get generic messages).

## 9. Post-Deployment Validation

- [ ] 24–48 h watch on error/latency dashboards; no isolation/authz alerts.
- [ ] Verify scheduled jobs ran (SLA checker, expiry reminders, leave accrual, backups).
- [ ] Confirm email queue draining with acceptable failure/retry rate.
- [ ] Reconcile a sample payroll run / EOSB calc with finance.
- [ ] Confirm backups produced and one restore test passes.
- [ ] Sign-off: security (isolation green), QA (suites green), HR/finance (calculation correctness), ops (monitoring live).

---

## Release readiness gate (summary)

| Gate | Owner | Must be true |
|---|---|---|
| Security | Security/Lead | Phase 1 complete; isolation + security suites green; secrets rotated; DB private |
| Quality | QA | CI green; migrations reversible; coverage targets met |
| Business | HR/Finance | EOSB/leave/payroll rules verified |
| Ops | DevOps | Backups, monitoring, logging, rollback rehearsed |

Only when all four gates pass does the system move from **development/UAT-only** to **production-eligible**.
