# syntax=docker/dockerfile:1
# =============================================================================
# Novelmaker — single-user, self-hosted web application.
#
# This image is built from THIS repository's source tree, not from a pinned
# upstream clone. That matters: the fork is where the web-application work
# happens, so a Dockerfile that fetched upstream would silently ignore every
# commit we make here.
#
# WHY THE LAUNCH COMMAND IS `node --import tsx ...` AND NOT `npm start`:
#   `npm start` runs the `tsx` CLI, which spawns a child node process. As PID 1
#   that wrapper does not forward SIGTERM to the server, so `docker stop` times
#   out and SIGKILLs — skipping the app's shutdown path (which writes a database
#   backup and releases the lock file). The `--import` form loads tsx as an ESM
#   loader hook inside a single process, so signals reach the server. Verified.
#
# WHY xdg-utils IS INSTALLED IN THE RUNTIME IMAGE:
#   `POST /api/system/reveal` (the "show folder" action) spawns `xdg-open` with
#   no 'error' listener. A missing binary raises an unhandled error event that
#   kills the whole server (reproduced: spawn xdg-open ENOENT -> process exit).
#   Having the binary present makes the spawn succeed; in a container the action
#   still opens nothing, which is harmless. It is a crash guard, not a feature.
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1 — build the web interface and install production dependencies.
# Full node:22 image toolchain: better-sqlite3 is a native module; if no prebuilt
# binary matches, node-gyp compiles it, which needs python3/make/g++.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS builder
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /src
# Manifests first, so the dependency layer caches across source edits.
COPY package.json package-lock.json ./
COPY shared/package.json ./shared/package.json
COPY server/package.json ./server/package.json
COPY web/package.json ./web/package.json
RUN npm ci --no-audit --no-fund

# Build from the repo's own source. Only web/dist is a build output; server and
# shared are consumed as raw TypeScript at runtime (see runtime stage).
COPY shared ./shared
COPY server ./server
COPY web ./web
# The web workspace's tsconfig extends the root base config.
COPY tsconfig.base.json ./tsconfig.base.json
RUN npm run build
# Drop build-only dependencies for the runtime copy. `tsx` is a *production*
# dependency of the server workspace, so it survives — and it is mandatory,
# since @novelmaker/shared resolves to src/index.ts (raw TS).
RUN npm ci --omit=dev --no-audit --no-fund

# -----------------------------------------------------------------------------
# Stage 2 — runtime.
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates xdg-utils \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production \
    NOVELMAKER_DATA=/data \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app
# Layout must preserve server/, shared/ and web/dist/: the server resolves
# ROOT_DIR to /app and serves the SPA from <ROOT_DIR>/web/dist. The workspace
# symlinks under node_modules/@novelmaker/* point back into these directories.
COPY --from=builder /src/node_modules ./node_modules
COPY --from=builder /src/package.json ./package.json
COPY --from=builder /src/shared ./shared
COPY --from=builder /src/server ./server
COPY --from=builder /src/web/package.json ./web/package.json
COPY --from=builder /src/web/dist ./web/dist

RUN mkdir -p /data
EXPOSE 3000

# Single process, so SIGTERM reaches the app's shutdown handler (backup + lock
# release). Do not replace this with `npm start`.
CMD ["node", "--import", "tsx", "server/src/index.ts"]
