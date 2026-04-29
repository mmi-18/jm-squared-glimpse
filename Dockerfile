# syntax=docker/dockerfile:1.7
#
# Multi-stage Docker build for the glimpse. Next.js 16 app.
#
# Stages:
#   - deps     installs node_modules + generates the Prisma client
#   - builder  runs `next build` → produces .next/standalone (a self-
#              contained server.js + minimal node_modules)
#   - runner   the actual production image: only what's needed at runtime,
#              non-root user, runs `prisma migrate deploy` then starts the
#              Next.js server via the entrypoint script
#
# Build args (set in CI via docker/build-push-action `build-args`):
#   - NEXT_PUBLIC_SITE_URL  baked into the client bundle for absolute URLs
#                           in metadata, og:image, sitemap.xml. Default
#                           localhost so local builds still work.

# ════════════════════════════════════════════════════════════════════════════
# Stage 1 — deps
# ════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy lock + manifest first so Docker can cache the install layer between
# code-only changes.
COPY package.json package-lock.json ./
COPY prisma ./prisma

# `npm ci` honors the lockfile exactly. The postinstall hook runs
# `prisma generate` so the client is ready for the builder stage.
RUN npm ci

# ════════════════════════════════════════════════════════════════════════════
# Stage 2 — builder
# ════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ════════════════════════════════════════════════════════════════════════════
# Stage 3 — runner
# ════════════════════════════════════════════════════════════════════════════
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Use the `node` user that ships with node:20-alpine (uid 1000, gid 1000).
# Matching the host's `mario` user (also uid 1000) lets bind-mounted volumes
# Just Work without manual chown — important because the deploy directory
# lives under /home/mario/glimpse/ and Mario doesn't have passwordless sudo.

# Public assets aren't part of the standalone output — copy explicitly.
COPY --from=builder /app/public ./public

# The standalone server bundle ships its own minimal node_modules + server.js.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

# Prisma client output (generated in `deps`) is required at runtime for any
# query. The `prisma` CLI + migrations folder are required for the
# `prisma migrate deploy` step the entrypoint runs at container start.
COPY --from=deps --chown=node:node /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=deps --chown=node:node /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=deps --chown=node:node /app/node_modules/prisma ./node_modules/prisma
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node scripts/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# Filesystem upload target. Mounted from the host as a volume in
# docker-compose so uploads survive container rebuilds.
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3000

# Curl-based liveness probe. Traefik does its own routing healthcheck via
# HTTP requests, but this lets `docker ps` flag a wedged container.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/ || exit 1

ENTRYPOINT ["./entrypoint.sh"]
