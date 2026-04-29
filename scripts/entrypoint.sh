#!/bin/sh
# Container entrypoint.
#
# Runs Prisma migrations against the configured DATABASE_URL/DIRECT_URL,
# then hands off to the Next.js standalone server. If the migration step
# fails, the container exits non-zero and Docker / Traefik will leave the
# previous container in place — partial deploys don't corrupt state.

set -e

echo "[entrypoint] Applying Prisma migrations..."
node node_modules/prisma/build/index.js migrate deploy

echo "[entrypoint] Starting Next.js server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}..."
exec node server.js
