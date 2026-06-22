# Security

The security model and operational checklist for the IST HR System. See [`DESIGN.md`](DESIGN.md) for architecture context.

---

## Authentication & sessions

- **JWT** bearer tokens (`jsonwebtoken`), 24h expiry (`JWT_EXPIRES_IN`). The `auth` middleware verifies the token only (no per‑request DB lookup).
- Passwords are hashed with **bcrypt** (`bcryptjs`). There is no self‑service password reset — an admin resets passwords from Users.
- The initial admin is seeded by `setup-db.js` with a random password (or `ADMIN_INITIAL_PASSWORD`); the owner has since changed it. Default credentials are intentionally **not** documented anywhere in the app.

## Authorization (RBAC + company scoping)

Three enforced layers (see `server/middleware/{rbac,tenant,auth}.js`):

1. **Role guards** — `authorize(...roles)` per route. **All `DELETE` routes require `admin`.**
2. **Company scoping** — `tenantScope` sets `req.companyId`; `companyClause()` filters every read and `:id` lookup (cross‑company `:id` mismatches return **404**, preventing IDOR); `resolveWriteCompanyId()` fixes the company on writes. A client‑supplied `company_id` can never widen scope beyond the role.
3. **UI** — delete buttons hidden for non‑admins (`{isAdmin && …}`); admin‑only pages/tabs (Users, System Config, Email) hidden by role.

Roles: `admin` (full), `hr_manager` (full HR, no delete, companies view‑only, no user management), `recruiter` (recruitment only), `employee` (own data only). Only a **platform admin** (admin with no bound company) can create/archive companies.

## Data protection

- **Stored account credentials** (the “Accounts” asset type) are encrypted with **AES‑256‑GCM** via `cryptoService`, using `ENCRYPTION_KEY` (64 hex chars, **distinct** from `JWT_SECRET`). Passwords are revealed only briefly to authorized users and auto‑hide in the UI.
- **Uploaded files / official documents** are stored on the persistent `/data/uploads` volume, scoped per company/employee, and survive redeploys. They are never committed to the repo.
- **Audit log** records create/update/delete and key actions (user, action, module, time, detail, `company_id`); admin‑readable, exportable as JSON.

## Transport & HTTP hardening (`server/app.js`)

- **Helmet** security headers; **CORS** locked to the exact `CLIENT_URL` in production; `trust proxy` enabled for correct client IPs behind the reverse proxy.
- **Rate limiting** on `/api/*`, with tighter limits on `/api/auth/login`, `/api/ai`, `/api/cv-scorer`, `/api/email`, and the public routes.
- **Email**: `emailService` derives TLS from the SMTP port (465 implicit TLS, 587 STARTTLS) and applies header‑injection guards on recipient/subject fields.
- `ALLOW_INSECURE_TLS` is a dev‑only escape hatch and has **no effect** when `NODE_ENV=production`.

## Secrets management

- **Never commit secrets.** `.env` is gitignored; `.env.example` is the template.
- Secrets are **runtime‑only** in Coolify (DB password, `JWT_SECRET`, `ENCRYPTION_KEY`, `DEEPSEEK_API_KEY`).
- The previously‑exposed secrets and a pasted GitHub PAT were **rotated**. The local repo `.env` intentionally holds the old/rotated values, so a local server cannot reach production data.
- Rotating `ENCRYPTION_KEY` invalidates previously‑encrypted stored passwords — plan a re‑entry if it ever changes.

## Production checklist (already completed by the owner)

- [x] Rotate all secrets that were ever exposed (DB, JWT, encryption key, AI key, PAT).
- [x] Set all secrets as **runtime‑only** in Coolify (not baked into the image/repo).
- [x] Change the default admin password.
- [x] DNS + HTTPS (Cloudflare A record + Let’s Encrypt).
- [x] Configure Coolify “Ports Exposes” and redeploy.
- [x] Mount the persistent `/data/uploads` volume.

## Reporting

This is a proprietary internal system. Report a suspected vulnerability privately to the maintainer; do not open a public issue with exploit details.
