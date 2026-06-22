# IST HR System

A bilingual (Arabic / English), multi‑company Human Resources Management System (HRMS) for a single organization that owns several companies. It covers the full employee lifecycle — recruitment, onboarding, leave, attendance, payroll, assets, performance, offboarding — plus compliance (UAE labor law, legal letters), analytics, and an AI assistant for CV parsing, candidate scoring and letter generation.

> **Status:** Feature‑complete (v2.5). Remaining work is operational testing across all live workflows.
> **Live:** deployed on Coolify from GitHub. **Languages:** English + Arabic (full RTL). **AI:** DeepSeek.

---

## Highlights

- **One organization, many companies.** Internal staff work across every company and switch the active **Entity** in the sidebar; the role decides *permissions*, the Entity decides *which company’s data* is shown.
- **Role‑based access.** `admin` (full), `hr_manager` (full HR, no deletes, companies view‑only), `recruiter` (recruitment only), `employee` (self‑service portal).
- **Recruitment suite.** ATS Kanban, candidates, vacancies, a public branded Careers page, applicants inbox, and AI CV scoring.
- **Stage‑gated onboarding.** CV → HR review → offer → signed offer → documents → visa → bank → completed; completion creates the employee automatically.
- **Documents by email as PDF.** Legal letters, offers, handover receipts and reports render to PDF in the browser (Arabic/RTL faithful) and are composed onto each company’s uploaded A4 **letterhead**, then emailed with a bilingual cover note and logged.
- **UAE labor‑law tooling.** End‑of‑service (EOSB) calculator per Federal Decree‑Law No. 33 of 2021, absence/lateness rules, visa/work‑permit references, exit decision matrix.
- **Security.** JWT auth, bcrypt passwords, AES‑256‑GCM for stored credentials, Helmet, rate limiting, full audit log, per‑request company scoping (IDOR‑safe), and an automated i18n audit gate.
- **In‑app Knowledge Base.** A `/help` center documenting every page with real screenshots, step‑by‑step guides and FAQs, in both languages.

---

## Tech stack

| Layer | Technology |
|------|------------|
| Client | React 19, Vite 8, Redux Toolkit, React Router 6, TailwindCSS 3, react-i18next, recharts / apexcharts, html2canvas + jsPDF + pdf-lib |
| Server | Node.js (ESM), Express 4, mysql2, Helmet, jsonwebtoken, bcryptjs, multer, nodemailer |
| Database | MySQL |
| AI | DeepSeek (CV parsing, candidate scoring, letter & interview‑question generation) |
| Tests | Vitest + Supertest (server), Vitest + Testing Library (client) |
| Deploy | Single multi‑stage Docker image, Coolify, persistent `/data/uploads` volume |

---

## Repository layout

```
.
├── client/                 # React + Vite front end
│   ├── public/kb/          # Knowledge-base screenshots (shipped, served at /kb/*)
│   └── src/
│       ├── api/            # axios API clients
│       ├── components/     # UI + layout (Sidebar, Topbar, ui/*)
│       ├── data/kb/        # Knowledge-base content (en.js / ar.js / index.js)
│       ├── locales/        # en.json / ar.json (i18n)
│       ├── pages/          # one folder per domain (recruitment, lifecycle, settings, …)
│       ├── store/          # Redux slices (auth, companies, entity)
│       └── utils/          # pdf.js, letterhead.js, confirm, cn, …
├── server/                 # Express API
│   ├── routes/             # one file per resource (employees, candidates, payroll, …)
│   ├── services/           # email, crypto, deepseek, eosb, payroll, audit, …
│   ├── middleware/          # auth, rbac, tenant (company scoping), validate, rateLimit, upload
│   ├── schema.sql          # base schema
│   ├── apply_*.mjs         # idempotent migrations (run via scripts/migrate.sh)
│   └── tests/              # vitest + supertest suites
├── Dockerfile              # multi-stage build (client → server runtime)
├── docker-compose.yml
├── DEPLOYMENT_COOLIFY.md   # production deployment guide
├── USER_GUIDE_EN.md / USER_GUIDE_AR.md   # end-user guides
├── DESIGN.md               # architecture & design decisions
├── SECURITY.md             # security model & operational checklist
├── CHANGELOG.md            # version history
└── CLAUDE.md / MEMORY.md   # context for AI-assisted development
```

---

## Quick start (local development)

**Prerequisites:** Node.js 20+, a MySQL database.

```bash
# 1. Configure environment
cp .env.example .env        # then fill in DB, JWT_SECRET, ENCRYPTION_KEY, DEEPSEEK_API_KEY

# 2. Server
cd server
npm install
node setup-db.js            # create schema + seed the initial admin (prints the generated password)
npm run migrate             # apply feature migrations (idempotent)
npm run dev                 # API on http://localhost:3001

# 3. Client (separate terminal)
cd client
npm install
npm run dev                 # Vite dev server on http://localhost:5173 (proxies /api → 3001)
```

> The Vite dev server proxies `/api` to `http://localhost:3001`. In production a single
> Express process serves both the API and the built client.

---

## Scripts

**Client** (`client/`)
| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Production build → `dist/` |
| `npm run test` | Vitest unit tests |
| `npm run i18n:check` | i18n audit gate (key parity + missing keys + hardcoded toasts) — must stay green |
| `npm run lint` | ESLint |

**Server** (`server/`)
| Script | Purpose |
|--------|---------|
| `npm start` | Run the API (`node server.js`) |
| `npm run dev` | Run with `--watch` |
| `npm run migrate` | Apply all migrations (`scripts/migrate.sh`) |
| `npm run test` | Vitest + Supertest suites (needs a reachable DB) |

---

## Environment

See [`.env.example`](.env.example) for the full template. Key variables:

- `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRES_IN` (default `24h`)
- `ENCRYPTION_KEY` — 64 hex chars, **distinct** from `JWT_SECRET`, used for AES‑256‑GCM credential storage
- `DEEPSEEK_API_KEY` / `DEEPSEEK_BASE_URL`
- `CLIENT_URL` — exact production origin (CORS) when `NODE_ENV=production`
- `UPLOADS_DIR` — must be a **mounted persistent volume** in production (`/data/uploads`)
- `CLIENT_DIST` — path to the built client served by Express in production

> **Never commit `.env`.** Secrets must be **runtime‑only** in Coolify. Rotate any secret that was ever committed.

---

## Deployment

Production is a single Docker image (client built in stage 1, served by the Express server in stage 2) deployed on **Coolify** from GitHub. Uploaded files persist on the `/data/uploads` volume; the container exposes a health check at `GET /api/health`.

Full instructions: [`DEPLOYMENT_COOLIFY.md`](DEPLOYMENT_COOLIFY.md).

---

## Documentation map

| Audience | File |
|----------|------|
| End users (HR/staff) | [`USER_GUIDE_EN.md`](USER_GUIDE_EN.md) / [`USER_GUIDE_AR.md`](USER_GUIDE_AR.md), and the in‑app **Help Center** (`/help`) |
| Architects / developers | [`DESIGN.md`](DESIGN.md) |
| Security & operations | [`SECURITY.md`](SECURITY.md) |
| Deployment | [`DEPLOYMENT_COOLIFY.md`](DEPLOYMENT_COOLIFY.md) |
| Version history | [`CHANGELOG.md`](CHANGELOG.md) |
| AI‑assisted development | [`CLAUDE.md`](CLAUDE.md), [`MEMORY.md`](MEMORY.md) |

---

## License

Proprietary — © IST. All rights reserved.
