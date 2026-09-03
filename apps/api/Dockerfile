# syntax=docker/dockerfile:1

# The API image, built from a clean checkout of the pnpm workspace. Build
# context is the **repo root** (see docker-compose.yml), because the lockfile,
# the workspace manifest and `packages/types` all live above `apps/api`.
#
# This image is not the deploy artifact — Render builds from source (render.yaml).
# Its job is to reproduce a fresh host locally: install from the lockfile, run
# the build, and start the same `node dist/main.js` Render runs. Run
# `docker compose build` before opening a `dev → main` PR to catch the errors
# that only appear without a warm `node_modules`/`dist`.

# ---------------------------------------------------------------------------
# build — install from the lockfile and compile the TypeScript
# ---------------------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

# pnpm comes from corepack, pinned by the root package.json `packageManager`
# field — the shim downloads that exact version on the first pnpm call.
RUN corepack enable

# Manifests first, so a source-only change reuses the install layer. Every
# workspace package the lockfile covers has to be here for --frozen-lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/

RUN pnpm install --frozen-lockfile

# Only what the API build needs — the SPA deploys to Vercel, not from here.
COPY packages/types packages/types
COPY apps/api apps/api

RUN pnpm --filter @olc/api build

# ---------------------------------------------------------------------------
# runtime — slim, prod deps only, starts the compiled app
# ---------------------------------------------------------------------------
# A second, separate install rather than pruning the build stage's tree:
# `pnpm prune --prod` at the workspace root does not reliably keep the
# workspace-package symlinks (apps/api/node_modules ended up empty, including
# `reflect-metadata`, a real prod dependency) — tried and reverted. A filtered
# prod install is the well-trodden pnpm-in-Docker path and does not have that
# failure mode.
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/types/package.json packages/types/

# `...` pulls in @olc/api's workspace dependency (@olc/types) too. Migrations
# run on the host against `db`'s published `localhost:5432` (see README), not
# inside this image, so nothing here needs `tsx` or `drizzle-kit`.
# `pnpm install` leaves its downloaded corepack binary and content-addressable
# store/metadata caches under root's home — none of it is needed after this,
# and it has to go in this same RUN or it survives as dead weight in the layer
# regardless of a later `rm`.
RUN pnpm install --prod --frozen-lockfile --filter "@olc/api..." \
 && rm -rf "$(pnpm store path)" ~/.cache/pnpm ~/.cache/node/corepack

COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/apps/api/dist apps/api/dist

# Everything the app reads is relative to the package root: `dist/main.js` and
# the `.env` cascade `shared/config` loads.
WORKDIR /app/apps/api
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
