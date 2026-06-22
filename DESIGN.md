# IST HR System — Design & Architecture

This document explains how the system is built and *why* the key decisions were made. For setup see [`README.md`](README.md); for deployment see [`DEPLOYMENT_COOLIFY.md`](DEPLOYMENT_COOLIFY.md); for the security model see [`SECURITY.md`](SECURITY.md).

---

## 1. Product model: one organization, many companies

The system is **not** a multi‑tenant SaaS where each company is an isolated tenant. It models **one organization** that owns several legal **companies (entities)** — e.g. *IST Real Estate LLC* and *IST Markets*. The implications drive most of the architecture:

- **Role governs permissions; the selected Entity governs data scope.** A `hr_manager` can see and act across every company; choosing an Entity in the sidebar simply *narrows* the view to one company. An `employee` is pinned to their own company.
- There is intentionally **no “All companies” option** in writes — every record belongs to exactly one company (`company_id`).
- **Cross‑company roles:** `admin`, `hr_manager`, `recruiter`. **Pinned role:** `employee`.

### Request scoping (`server/middleware/tenant.js`)

`tenantScope` runs after `auth` on every protected router and sets:

- `req.companyId` — for cross‑company roles, the client‑supplied `company_id` (query/body) or `null` (= all companies); for employees, their own `company_id` from the token (client value ignored).
- `req.crossCompany` — boolean.
- `req.isPlatformAdmin` — `admin` **and** no bound company; gates company *management* only.

Two helpers keep scoping consistent and IDOR‑safe:

- `companyClause(req, column)` → `{ clause, params }` appended to every list/`:id` query. When `req.companyId` is `null`, the clause is empty (org‑wide). A cross‑company `:id` lookup that doesn’t match the selected Entity returns **404**.
- `resolveWriteCompanyId(req, body)` → the company a new row is written under (selected Entity for internal staff, own company for employees).

This is the single most important invariant: **no route trusts a client `company_id` to widen scope** beyond what the role allows.

---

## 2. Roles & permissions

| Role | Data scope | Notable limits |
|------|-----------|----------------|
| `admin` | All companies | Full: settings, users, create/edit/**delete**, company management |
| `hr_manager` | All companies | Full HR + structural settings, **cannot delete anything**, **cannot add/edit companies** (view‑only), cannot manage users |
| `recruiter` | All companies | Recruitment only (candidates, vacancies, ATS, applicants) |
| `employee` | Own company | Self‑service portal only (own assets & accounts) |

Enforced in three layers:

1. **Route guards** — `authorize(...roles)` (`server/middleware/rbac.js`). All `DELETE` routes are `authorize('admin')`.
2. **Company scoping** — `tenantScope` + `companyClause` (above).
3. **UI** — delete buttons are wrapped in `{isAdmin && …}` so non‑admins never see an action that would 403; admin‑only pages/tabs (Users, System Config, Email) are hidden by role.

`isPlatformAdmin` (admin with no bound company) is the only thing that can create/archive companies.

---

## 3. Backend architecture

- **Express 4, ESM.** `server/app.js` wires Helmet, CORS (locked to `CLIENT_URL` in production), `trust proxy`, rate limiters, JSON body parsing, all routers under `/api/*`, a `/api/health` endpoint, and static serving of the built client in production.
- **One router per resource** in `server/routes/` (employees, candidates, vacancies, applications, onboarding/onboardingV2, leave, attendance, payroll, assets, inventory, legal, documents, reports, kpi, performance, offboarding, companies, departments, jobTitles, skills, users, audit, email, settings, portal, public, dashboard, ai, cvScorer, backup, migrate, notifications). Each router does `router.use(auth, tenantScope)`.
- **Services** (`server/services/`) hold cross‑cutting logic:
  - `cryptoService` — AES‑256‑GCM encrypt/decrypt for stored account passwords.
  - `auditService` — append‑only audit entries (with `company_id`).
  - `emailService` / `emailTemplates` — nodemailer transport (TLS mode derived from port: 465 implicit, 587 STARTTLS), bilingual templates, attachments + CC, header‑injection guards.
  - `deepseekService` / `cvParserService` — AI CV parsing/scoring/letters; `mammoth` + `pdf-parse` extract text.
  - `eosbService` / `payrollService` — UAE end‑of‑service and monthly payroll math.
  - `onboardingStageService` — the stage‑gate engine.
  - `barcodeService` / `notificationService`.
- **Middleware:** `auth` (JWT verify, no DB lookup), `rbac` (`authorize`), `tenant` (scoping), `validate` (declarative field validation), `rateLimit`, `upload` (multer + storage helpers).
- **Persistence:** MySQL via `mysql2` pool. `schema.sql` is the base; feature changes are **idempotent migrations** `apply_*.mjs` run in order by `scripts/migrate.sh`. `setup-db.js` seeds the initial admin (random password unless `ADMIN_INITIAL_PASSWORD` is set).

---

## 4. Frontend architecture

- **React 19 + Vite 8 (rolldown).** Routing via React Router 6; an authenticated `MainLayout` (Sidebar + Topbar) wraps the app routes, plus public routes (login, Careers).
- **State:** Redux Toolkit with three slices — `auth` (user/token), `companies` (the org’s companies), `entity` (the selected company). API calls go through axios clients in `src/api/` that attach the JWT and the selected `company_id`.
- **Pages** are grouped by domain under `src/pages/` (recruitment, lifecycle, compliance/legal, analytics, settings, users, portal, public, help). Heavy pages are lazy‑loaded.
- **Design system:** Tailwind 3 with brand tokens; reusable `components/ui/*` (Card, Button, Modal, Badge, EmptyState…). Charts via recharts/apexcharts.
- **Bundle strategy:** `vite.config.js` `manualChunks` splits vendor families (react, redux, charts, i18n, icons); the PDF libraries (`html2canvas`, `jspdf`, `pdf-lib`) are **left unassigned** so they stay in lazy chunks loaded only when a document is generated — keeping the entry chunk small.

### Internationalization & RTL

- `react-i18next` with a flat‑namespace `en.json` / `ar.json`. `src/i18n.js` applies document `dir`/`lang` (RTL for `ar`/`he`/`fa`/`ur`) on init and on language change.
- **Audit gate:** `npm run i18n:check` (`client/scripts/i18n-audit.mjs`) fails on key‑parity breaks, missing `t()` keys, or hardcoded toast strings. CI/PR discipline keeps it green.

### PDF generation & letterhead (`src/utils/pdf.js`, `letterhead.js`)

Documents are rendered **client‑side** so Arabic/RTL come out exactly as displayed:

1. `html2canvas` rasterizes the on‑screen document → image.
2. `jsPDF` builds an A4 image‑PDF.
3. If the issuing company has an uploaded letterhead, `pdf-lib` composes the content image onto the letterhead page with per‑company millimetre margins, paginating as needed.

The same composed PDF is used for **Print**, **Download**, and **Send by email** (attached with a bilingual “as per your request…” cover note), and every send is recorded in the Email Log. Letterheads are uploaded per company in Settings → Companies (admin only) and stored on the persistent volume.

---

## 5. Cross‑cutting workflows

- **Recruitment → hire:** Vacancy → public Careers page → Applicants (interview/evaluate) → *Convert to onboarding*.
- **Onboarding (stage‑gated):** each stage unlocks only when its requirements are met (`onboardingStageService`); completion creates an Active employee linked to the record.
- **Time & pay:** Leave (entitlements/balances) and Attendance feed **deductions** into monthly **Payroll Runs**; EOSB and labor‑law references live in the separate **Payroll & Labor Law** calculators.
- **Assets:** Asset Catalog (types) → Inventory (physical items) → Assets (assignment to employees, with encrypted account credentials and a printable/emailable handover receipt) → return.
- **Email:** all outbound mail flows through `emailService`, is templated, and is captured in the Email Log with status.

---

## 6. Knowledge Base

In‑app help at `/help`. Content lives in `client/src/data/kb/{en,ar,index}.js` (identical article ids per language) — deliberately **outside** the i18n JSON so the audit gate stays clean and the large content stays maintainable. Each article has overview / when‑to‑use / optional flow diagram / a **real screenshot gallery** (files in `client/public/kb`, served at `/kb/*`, opened in a lightbox) / steps / tips / FAQ / related links. A contextual “?” button in the Topbar deep‑links to the current page’s article.

---

## 7. Key design decisions (and rationale)

| Decision | Why |
|----------|-----|
| Single‑org model, not isolated tenants | The business is one company group; staff must work across entities. Role‑based permissions + Entity scoping fit reality better than hard tenant isolation. |
| Client‑side PDF rendering | Guarantees faithful Arabic/RTL output and lets letterhead composition reuse the exact on‑screen layout. |
| KB content outside i18n JSON | Keeps the translation audit gate meaningful and the (large) help content easy to edit. |
| Idempotent `apply_*.mjs` migrations | Safe to re‑run on every deploy; no migration framework lock‑in. |
| Secrets runtime‑only; `.env` gitignored | Prevents credential leakage; the repo never carries live secrets. |
| Delete restricted to `admin` + hidden in UI | Matches the `hr_manager` “no delete” rule and avoids dead buttons that 403. |
| Lazy PDF vendor chunks | Heavy libs (~700KB+) load only when generating a document, keeping first paint fast. |

---

## 8. Testing

- **Server:** Vitest + Supertest suites in `server/tests/` cover isolation/scoping (single‑org model), EOSB, leave, attendance, payroll, onboarding v2, recruitment, notifications and validation. They require a reachable database.
- **Client:** Vitest + Testing Library; the i18n audit gate runs as part of the build discipline.

> Note: the local `.env` holds rotated credentials, so server tests run against a developer DB, not production.
