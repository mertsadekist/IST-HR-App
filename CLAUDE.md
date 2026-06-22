# CLAUDE.md — working in the IST HR System repo

Guidance for Claude Code (or any AI assistant) contributing to this project. Read this first, then [`DESIGN.md`](DESIGN.md) for architecture and [`MEMORY.md`](MEMORY.md) for current state.

---

## What this project is

A bilingual (AR/EN, full RTL) multi‑company HRMS for **one organization that owns several companies**. Role governs *permissions*; the selected **Entity** (`company_id`) governs *which company’s data* is shown. Stack: React 19 + Vite 8 (client), Node ESM + Express 4 + MySQL (server), DeepSeek AI. Deployed as a single Docker image on Coolify. Current version: **v2.5** (feature‑complete; operational testing ongoing).

Platform note: development is on **Windows**; the shell is **PowerShell**, with a Bash tool also available. Prefer absolute paths; avoid `cd`‑prefixed commands.

---

## Commands

```bash
# Client (client/)
npm run dev            # Vite dev server (proxies /api → :3001)
npm run build          # production build — run before committing client changes
npm run i18n:check     # i18n audit gate — MUST stay green
npm run test           # Vitest
npm run lint           # ESLint

# Server (server/)
npm run dev            # node --watch server.js
npm run migrate        # apply idempotent migrations (scripts/migrate.sh)
npm run test           # Vitest + Supertest (needs a reachable DB)
node setup-db.js       # create schema + seed initial admin
```

**Definition of done for a change:** `npm run build` passes **and** `npm run i18n:check` is green (when touching the client). Server logic changes should keep `server/tests` consistent with the single‑org model.

---

## Conventions (match the existing code)

- **No hardcoded user‑facing strings.** Everything goes through `t('namespace.key')` with both `en.json` and `ar.json` updated in parity. Toasts included. The audit gate enforces this.
- **Knowledge Base content** lives in `client/src/data/kb/{en,ar,index}.js` (NOT in the i18n JSON). Screenshots live in `client/public/kb/` (slug‑named, served at `/kb/*`). Keep `en.js`/`ar.js` article `id`s identical.
- **Company scoping is mandatory** on every data route: `router.use(auth, tenantScope)`, then `companyClause(req, 'col')` on reads and `resolveWriteCompanyId(req, body.company_id)` on writes. Never trust a client `company_id` to widen scope.
- **Deletes are `authorize('admin')`** on the server, and the UI hides delete buttons for non‑admins via `const isAdmin = user?.role === 'admin'` + `{isAdmin && …}`.
- **Path aliases (client):** `@`, `@api`, `@components`, `@pages`, `@store`, `@hooks`, `@utils`, `@assets`, `@configs`, `@layout`. There is **no** `@data` alias — import KB as `@/data/kb`.
- **Apostrophes in KB/data strings** use the typographic `’` / `“ ”` to avoid escaping inside single‑quoted JS.
- **Migrations** are idempotent `server/apply_*.mjs` added to `server/scripts/migrate.sh` — never edit historical migrations; add a new one.
- **PDFs** are generated client‑side (`utils/pdf.js`: html2canvas → jsPDF → pdf‑lib letterhead composition). Keep PDF libs lazily imported so they stay out of the entry bundle (see `vite.config.js` `manualChunks`).

---

## Security constraints (do not violate)

- **Never commit secrets.** `.env` is gitignored and holds rotated/old credentials locally. Secrets are **runtime‑only** in Coolify. If you ever see a real key in a diff, stop and flag it.
- `ENCRYPTION_KEY` (AES‑256‑GCM for stored account passwords) must stay distinct from `JWT_SECRET`.
- Uploaded files/official documents live on the persistent `/data/uploads` volume — never write user uploads into the repo.
- Don’t weaken Helmet/CORS/rate‑limit/`trust proxy` settings in `server/app.js` without a clear reason.
- Don’t expose the default admin credentials anywhere (they were removed from the KB on purpose).

---

## Where things are

| Need | Location |
|------|----------|
| API route for a resource | `server/routes/<resource>.js` |
| Business logic | `server/services/*` |
| Company scoping / roles | `server/middleware/{tenant,rbac,auth}.js` |
| A page | `client/src/pages/<domain>/*` |
| Shared UI | `client/src/components/ui/*`, `components/partials/{Sidebar,Topbar}.jsx` |
| Redux | `client/src/store/slices/{auth,companies,entity}.js` |
| i18n strings | `client/src/locales/{en,ar}.json` |
| Help content | `client/src/data/kb/*`, screenshots in `client/public/kb/` |
| PDF / letterhead | `client/src/utils/{pdf,letterhead}.js` |
| Deploy | `Dockerfile`, `docker-compose.yml`, `DEPLOYMENT_COOLIFY.md` |

---

## Gotchas

- The Vite build is **rolldown**‑based; `build.rollupOptions.output.manualChunks` works, but forcing lazily‑imported libs into a manual chunk makes them eager — leave PDF libs unassigned.
- `auth` middleware only verifies the JWT (no DB lookup), so tests can mint tokens directly.
- A wrong **Entity** is the usual reason data “doesn’t appear” — it’s scoping, not a bug.
- Git on Windows warns about LF→CRLF; that’s harmless.
- Commit/push only when asked. End commit messages with the `Co-Authored-By` footer.

---

## Typical task recipe

1. Read the relevant route + page + slice.
2. Make the change respecting scoping, roles, and i18n parity.
3. `npm run build` + `npm run i18n:check` (client) / keep tests consistent (server).
4. Commit with a clear message; push only if asked.
