# Security audit — November 2026

Method: the multi-phase approach of Cloudflare's
[security-audit-skill](https://github.com/cloudflare/security-audit-skill) — map
trust boundaries, hunt unit by unit, try to disprove every candidate, and only
call a finding **confirmed** when it is traced end to end in the source. Three
independent read-only hunters covered (1) authentication / authorization / tenant
isolation, (2) injection and untrusted-input sinks, (3) secrets, crypto,
deployment, supply chain and availability. The new Hik Central code was audited
as part of all three. Results below were traced in source; **none was exploited
against a running system**. `npm audit` could not reach the registry from the
audit machine (TLS-intercepting proxy) — re-run `npm audit --omit=dev` in
`server/` and `client/` on a clean network.

No real secret was found in tracked files or in git history.

## Fixed in this change

| # | Finding | Fix |
|---|---|---|
| 1 | **High** — `POST /employees/onboard` stored a client-supplied `file_path` / `photo_path`; the download, photo and delete routes then read and **unlinked any file the server could reach** (`path.join` never checked containment) | `uploadPath()` now refuses any path outside the uploads volume; `/onboard` accepts bare file names only and ignores `photo_path` |
| 2 | **High** — every rate limiter keyed on `req.baseUrl + req.path`, which keeps the URL's case: `/Api/auth/login` got a fresh 10-attempt allowance, so login brute-force was effectively unlimited | key is case-insensitive and slash-insensitive; bucket map is bounded |
| 3 | **High** — a company-bound admin could restore a `users` row with `role=admin, company_id=NULL` through `/backup/import` and become a platform admin | import skips such rows unless the caller is a platform admin |
| 4 | **Medium** — "Test SMTP" with a blank password sent the **stored SMTP password** to any host the caller named; saving a new host kept the stored password | the stored password is only used for the stored host/user; changing either requires re-entering it |
| 5 | **Medium** — unauthenticated careers form put raw names into HTML emails sent from the company SMTP to any address | names with `<` / `>` or over 100 characters are rejected |
| 6 | **Medium** — multer filenames embedded the raw `:id` route param (`%2F` traversal) on photo and letterhead uploads | id is parsed to an integer |
| 7 | **Medium** — an admin could approve a salary review while impersonating the designated approver, defeating "preparer cannot approve" | `denyImpersonated` on the decision route |
| 8 | **Medium** — recruiters and accountants could read the cross-company audit log through `/dashboard/recent-activity` | admin / hr_manager only |
| 9 | **Low** — generated passwords used `Math.random()` | `crypto.randomBytes` |
| 10 | **Low** — unmounted `routes/employees_additions.js` carried the same path flaw | deleted |
| 11 | **Availability** — an unawaited rejected promise (DB down) kills the process and loops the container | `unhandledRejection` logger |
| — | **Hik sync** — HR corrections through `PUT /attendance/:id` kept `source='Hik Central'` and were overwritten by the next live pass | edits and HR upserts now mark the row `Manual` (protected) |
| — | **Hik sync** — self check-in rows defaulted to `Manual`, so the door feed could never correct them | new `Self Service` source, replaced by door punches |
| — | **Hik sync** — raw driver errors (host, user) reached the UI and the email | errors are classified; admins alone see host/port in *Test connection* |

Regression tests: `tests/hardening.test.js`, `tests/hikSync.test.js`,
`tests/hikClient*.test.js`.

## Open — needs a decision or a deploy-side change

| # | Severity | Finding | Recommendation |
|---|---|---|---|
| A | High | **hr_manager can bypass the admin-only credential reveal**: `PUT /assets/:id` takes `req.body` into `UPDATE … SET ?` (can re-point `employee_id`), `create-login` hands over a plaintext password, and `GET /portal/my-assets/:id/reveal` has no reason / step-up / limiter / `status='Active'` check | whitelist columns on `POST/PUT /assets`; give the portal reveal the admin reveal's controls |
| B | High | `/backup/export` returns **every company's data and all `password_hash` values** to any admin; `/migrate/localStorage` lets any admin write into any company; `PUT /email/config` with no `company_id` overwrites the global SMTP config | require a platform admin (`company_id IS NULL`) for backup, migrate and the global SMTP config; drop `password_hash` from export. *Not done here because it would lock out an owner account that is bound to a company — confirm first.* |
| C | Medium | Stateless 24 h JWT, no revocation: a disabled / demoted user or a stolen token stays valid for a day | `token_version` column checked in `auth`, or a short cache of `is_active`/`role` |
| D | Medium | Public careers form: file is written to disk **before** any validation (disk fill), then a paid AI call and an email per submission; consent IP is the raw `X-Forwarded-For` | validate slug/fields before multer, unlink on every failure, CAPTCHA, use `req.ip` |
| E | Medium | Public assessment: applicant text sits between fixed delimiters it can close; the AI score is applied as `Passed` without a human gate | random per-request delimiters; require HR sign-off |
| F | Medium | `docker-compose.yml` publishes `3001:3001`. If reachable from the internet it bypasses the proxy and lets a client forge `X-Forwarded-For` (defeats the rate limits) | use `expose`, not `ports`; confirm how the real client IP arrives (Cloudflare in front of Traefik?) |
| G | Medium | **Database links without verified TLS**: main MySQL (`db.js` has no `ssl`) and the Hik Postgres (`HIK_DB_SSL=require` does not check the certificate). Forged punches become attendance and then payroll | `HIK_DB_SSL=verify` + `HIK_DB_SSL_CA`; firewall both DB ports to the app server |
| H | Medium | The credential-reveal audit does not fail closed: `addAudit` swallows its own errors, so the 503 branch can never run; `reason` is unbounded | cap `reason`; make the audit write strict for reveals |
| I | Low–Med | xlsx 0.18.5 (prototype pollution, ReDoS) on `/attendance/import` (HR only); pdf-parse 1.1.1 (pdf.js 1.10) and mammoth on **unauthenticated** CV uploads (DoS) | parse in a worker with limits; move to the SheetJS 0.20 build or exceljs; replace pdf-parse |
| J | Low–Med | Dockerfile: Node 20 (EOL), no `USER` (process is root), `npm install` instead of `npm ci`; `.dockerignore` patterns are root-anchored | `node:22-alpine`, `USER node` (chown `/data/uploads`), `npm ci`, `**/.env*` |
| K | Low | `USER_GUIDE_*.md` still print `admin / admin123` (CLAUDE.md says default credentials must not be published); `server/run_full_scenario.js` hard-codes a DB address, logs in as `admin/admin123` and **deletes a company** in whatever DB the env names | remove both; confirm no account still uses that password |
| L | Low | Real employee names and a day of attendance are in git **history** (`tests/fixtures/attendance_2026-08-10.csv`, now deleted from the tree); `server/data/domain_export_*.csv` holds registrant PII | fine if the GitHub repo is private; otherwise purge history |
| M | Low | No self-service password change, no forced change at first login, username enumeration by login timing, no failed-login audit, `morgan('dev')` logs assessment tokens in URLs, production CORS falls back to `*` if `CLIENT_URL` is unset | see report |

## Hik Central sync — security properties

- Table and column names (from `HIK_*`) pass a strict identifier pattern and are
  double-quoted; every value is a bound parameter. 28 tests cover hostile names.
- Every query runs `BEGIN READ ONLY` with a `statement_timeout`; use a
  `SELECT`-only role as well.
- TLS defaults to `require` in production; use `verify` for an untrusted network.
- Secrets are runtime-only; `hik*.sql` is git-ignored.
- An absence is never written from missing data: a day with no punches from
  anyone, a holiday, a rest day or a missing schedule produce no absence.
