# ============================================================================
# IST HR System — single-image production build (client + server)
# Build context = repository root.  Used by Coolify (Dockerfile build pack).
# ============================================================================

# ---------- Stage 1: build the React client ----------
FROM node:20-alpine AS client
# Build the client with dev dependencies (vite, etc.) regardless of any injected
# NODE_ENV. `npm install` (not `npm ci`) tolerates lockfile drift and the
# platform-specific optional deps (rollup/esbuild) that differ on alpine/musl.
ENV NODE_ENV=development
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --include=dev --no-audit --no-fund
COPY client/ ./
RUN npm run build          # → /app/client/dist

# ---------- Stage 2: server runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    UPLOADS_DIR=/data/uploads \
    CLIENT_DIST=/app/client/dist \
    TZ=Asia/Dubai

# tzdata so named timezones (e.g. Asia/Dubai) resolve for the configurable app TZ.
RUN apk add --no-cache tzdata

WORKDIR /app/server
# Install production dependencies only. `npm install` (not `npm ci`) so the build
# is resilient to lockfile drift / platform-specific optional deps.
COPY server/package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

# App source
COPY server/ ./
# Built client (served by Express in production)
COPY --from=client /app/client/dist /app/client/dist

# Persistent uploads directory (mounted as a volume at runtime)
RUN mkdir -p /data/uploads

EXPOSE 3001

# Container healthcheck hits the API health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "server.js"]
