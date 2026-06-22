# MEMORY.md — project state & key facts

A durable snapshot of where the IST HR System stands, the non‑obvious decisions, and operational facts that aren’t derivable from the code alone. Update this when the state materially changes. Pair with [`CLAUDE.md`](CLAUDE.md) (how to work) and [`DESIGN.md`](DESIGN.md) (how it’s built).

_Last updated: 2026‑06‑22 · Version: v2.5_

---

## Current status

- **Feature‑complete.** All modules are built and wired. Remaining work is **operational testing across every live workflow** (recruitment → onboarding → lifecycle → payroll → offboarding, plus document email/letterhead and the calculators).
- Deployed on **Coolify** from GitHub, single Docker image. Domain fronted by Cloudflare with HTTPS (Let’s Encrypt).
- Version is **v2.5** (sidebar footer + both `package.json`s).

## The product model (most important fact)

One organization owns several companies. **Role = permissions, Entity = data scope.** Internal staff (`admin`, `hr_manager`, `recruiter`) are cross‑company and pick the active company via the sidebar Entity switcher; `employee` is pinned to their own company. There is no “All companies” for writes. See `server/middleware/tenant.js` and [`DESIGN.md`](DESIGN.md) §1.

## Roles

- `admin` — everything, including delete and company management.
- `hr_manager` — full HR across all companies, **no delete**, **companies view‑only**, **no user management**.
- `recruiter` — recruitment only.
- `employee` — self‑service portal only.

## Secrets & environment (operational truth)

- The previously‑exposed secrets (DB password, `JWT_SECRET`, `ENCRYPTION_KEY`, `DEEPSEEK_API_KEY`) and a pasted GitHub PAT have all been **rotated** by the owner.
- Secrets are **runtime‑only in Coolify**; `.env` is gitignored.
- The **local repo `.env` holds the OLD/rotated credentials**, so a locally‑run server/tests cannot reach the live DB. (This is why real‑app screenshots and live server tests can’t be produced locally without fresh dev credentials.)
- `ENCRYPTION_KEY` is AES‑256‑GCM for stored account passwords and is distinct from `JWT_SECRET`.
- Uploaded files/official documents persist on the **`/data/uploads`** volume and survive redeploys. Only runtime files deploy (docs/guides excluded via `.dockerignore`).

## Owner‑completed operational items

The owner confirmed they handled: secret rotation, runtime‑only secrets, admin password change, DNS + HTTPS, Coolify “Ports Exposes”, and redeploy.

## Notable engineering decisions / history

- **i18n:** fully translated EN/AR with RTL; an audit gate (`npm run i18n:check`) enforces key parity, no missing `t()` keys, and zero hardcoded toasts. Keep it green.
- **Letterhead/PDF:** client‑side render (html2canvas → jsPDF → pdf‑lib) so Arabic/RTL is faithful; per‑company A4 letterhead uploaded in Settings → Companies (admin), composed behind generated PDFs with mm margins; used for letters, offers, handover receipts, reports, and Print.
- **Send‑by‑email:** any document can be emailed as a PDF with a bilingual cover note; logged in the Email Log.
- **hr_manager rule enforced** in 3 layers: route guards (`authorize('admin')` on deletes), `tenantScope`/`companyClause`, and UI (`{isAdmin && …}` hides delete buttons; admin‑only Settings tabs hidden).
- **Isolation tests rewritten** to the single‑org model (cross‑company roles see the whole org and narrow by selected Entity; employees pinned; permissions still hold).
- **Code‑splitting:** `vite.config.js` `manualChunks` splits vendor families; PDF libs left unassigned so they stay lazy. Entry chunk ~265KB; no chunk‑size warning.
- **Knowledge Base:** in‑app `/help`, content in `client/src/data/kb`, rebuilt with **104 real screenshots** in `client/public/kb` (served `/kb/*`) and a lightbox; the raw `Knowledge Base Images/` source folder is gitignored.
- Default admin credentials were **removed** from the KB on purpose — never reintroduce them.

## Known constraints / cannot‑do‑locally

- Can’t run the live app or server tests locally without fresh dev DB credentials (rotated password).
- Can’t capture new live screenshots locally for the same reason; the KB uses the screenshots the owner supplied.

## Good next steps (when resumed)

- Operational test pass across all workflows with seeded data.
- Run `server/tests` against a developer DB to confirm green under the single‑org model.
- Optional: CONTRIBUTING.md / CI workflow that runs `i18n:check` + build + server tests on PRs.
