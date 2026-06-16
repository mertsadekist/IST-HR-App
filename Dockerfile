# ============================================================================
# IST HR System — single-image production build (client + server)
# Build context = repository root.  Used by Coolify (Dockerfile build pack).
# ============================================================================

# ---------- Stage 1: build the React client ----------
FROM node:20-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build          # → /app/client/dist

# ---------- Stage 2: server runtime ----------
FROM node:20-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    UPLOADS_DIR=/data/uploads \
    CLIENT_DIST=/app/client/dist

WORKDIR /app/server
# Install production dependencies only
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

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
