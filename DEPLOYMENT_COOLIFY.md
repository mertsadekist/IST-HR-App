# Deploying IST HR System on Coolify

Single Docker image: the React client is built and served by the Express API
(same origin → relative `/api` works, no CORS headaches). Uploaded files live on
a **persistent volume** so they survive every redeploy from GitHub.

---

## 1. What persists across redeploys

| Data | Where | Survives redeploy? |
|---|---|---|
| Database (employees, candidates, applications, onboarding, payroll, audit…) | **Remote MySQL** (external, in `DB_*` env) | ✅ independent of the container |
| Uploaded files (CVs, employee documents, signed offers, handover receipts, asset images, onboarding files, application CVs) | **`/data/uploads`** mounted volume (`UPLOADS_DIR`) | ✅ named volume, not rebuilt with the image |
| App code | Docker image | rebuilt each deploy (expected) |

> The image is **stateless**. All state is in MySQL + the `/data/uploads` volume. A
> redeploy never touches either.

---

## 2. One-time setup in Coolify

1. **New Resource → Application → from your GitHub repo** (branch `main`).
2. **Build Pack:** `Dockerfile` (root `Dockerfile`) — or **Docker Compose** using the
   repo `docker-compose.yml` (recommended: it declares the volume + healthcheck).
3. **Port / domain:** container listens on **3001**. Map your domain to it; enable HTTPS.
4. **Persistent storage (critical):** add a volume/mount
   - Source: a named volume (e.g. `ist_uploads`) · Destination (container path): **`/data/uploads`**
   - If using the compose file, this is already declared as the `ist_uploads` volume.
5. **Environment variables** (Settings → Environment):
   ```
   NODE_ENV=production
   PORT=3001
   UPLOADS_DIR=/data/uploads
   CLIENT_DIST=/app/client/dist
   CLIENT_URL=https://your-domain.example.com

   DB_HOST=...        DB_PORT=...     DB_USER=...
   DB_PASSWORD=...     DB_NAME=...

   JWT_SECRET=<64+ random hex>        JWT_EXPIRES_IN=24h
   ENCRYPTION_KEY=<32-byte hex>       # REQUIRED — app refuses to start without it
   DEEPSEEK_API_KEY=...               DEEPSEEK_BASE_URL=https://api.deepseek.com
   ```
   Generate secrets:
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"   # JWT_SECRET
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"   # ENCRYPTION_KEY
   ```
   ⚠️ Rotate any secret that was ever committed. Keep MySQL on a private network / IP allowlist.
6. **Deploy.**

---

## 3. Database migrations

The schema already exists on the current DB. For a **fresh** database:
1. Load the base schema once: `mysql ... < server/schema.sql`
2. Apply incremental migrations (idempotent):
   - From a one-off container shell in Coolify (Terminal): `cd /app/server && npm run migrate`
   - Or locally against the DB: `cd server && npm run migrate`

`npm run migrate` runs every `apply_*.mjs` in order; all are safe to re-run.

---

## 4. Healthcheck & logs

- Health endpoint: `GET /api/health` → `{ "status": "ok" }` (the container HEALTHCHECK uses it).
- Structured request logs via morgan; app errors are logged to stdout (Coolify logs).

---

## 5. Backups (recommended)

- **Database:** schedule automated MySQL dumps (Coolify DB backups or a cron `mysqldump`), retain ≥30 days off-host.
- **Uploads volume:** snapshot/back up the `/data/uploads` volume periodically (Coolify volume backup or a host-level `tar` of the volume mount). Combined with the DB backup this is a full restore point.

---

## 6. Redeploy from GitHub — safety checklist

- Push to `main` → Coolify rebuilds the image and restarts the container.
- The `/data/uploads` volume and the remote MySQL are **reused as-is** → no document or record loss.
- If you change the uploads path, migrate the volume contents first (don't repoint `UPLOADS_DIR` to an empty location).

---

## 7. Local Docker test (optional)

```
docker compose up --build
# open http://localhost:3001  (client served by the API)
```
Files written during the test land in the `ist_uploads` volume; `docker compose down` (without `-v`) keeps them.
