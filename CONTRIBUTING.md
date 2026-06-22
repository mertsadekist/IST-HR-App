# Contributing

Conventions for contributing to the IST HR System. For architecture see [`DESIGN.md`](DESIGN.md); for AI‑assisted work see [`CLAUDE.md`](CLAUDE.md).

## Workflow

1. Branch off `main`.
2. Make the change, keeping it scoped and consistent with surrounding code.
3. Verify (see below).
4. Open a PR with a clear description; link any related issue. End commit messages and PR bodies per the repo’s footer convention.

## Verify before you push

**Client changes** (`client/`):
```bash
npm run build         # must pass
npm run i18n:check    # must be green (key parity, no missing keys, no hardcoded toasts)
npm run lint
```

**Server changes** (`server/`):
```bash
npm run test          # Vitest + Supertest (needs a reachable dev DB)
```

A change is **done** when the build passes and the i18n gate is green (client), and the relevant server tests stay consistent with the single‑organization model.

## Non‑negotiables

- **No hardcoded user‑facing strings.** Use `t('ns.key')` and update **both** `en.json` and `ar.json` in parity (toasts included).
- **Company scoping on every data route:** `router.use(auth, tenantScope)`, `companyClause()` on reads, `resolveWriteCompanyId()` on writes. Never trust a client `company_id` to widen scope.
- **Deletes are `admin`‑only** (server `authorize('admin')`) and hidden in the UI for non‑admins.
- **Never commit secrets.** `.env` is gitignored; secrets are runtime‑only.
- **Migrations are additive:** add a new idempotent `server/apply_*.mjs` and register it in `scripts/migrate.sh`; never edit historical migrations.
- **Knowledge Base** content goes in `client/src/data/kb/{en,ar}.js` (identical ids), screenshots in `client/public/kb/` — not in the i18n JSON.

## Style

- Match the existing file’s naming, comment density and idioms.
- Keep PDF libraries lazily imported (don’t pull them into the entry bundle).
- Reference files as `path:line` in reviews so they’re clickable.
