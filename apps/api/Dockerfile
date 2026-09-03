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
# runtime — slim, no build toolchain, starts the compiled app
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
# Shared corepack cache so the pnpm the `packageManager` field pins is already
# downloaded and readable by the unprivileged `node` user.
ENV COREPACK_HOME=/opt/corepack
WORKDIR /app

# The installed tree comes from the build stage rather than a second install:
# pnpm's symlinks into `node_modules/.pnpm` are relative, so they survive the
# copy. `apps/web` is left behind. This keeps `pnpm --filter @olc/api
# db:migrate` runnable in this image (it needs `tsx` and `drizzle/`), which is
# how migrations are applied to the compose database — at the cost of carrying
# the API's devDependencies. Fine for a local image; a deploy artifact would
# prune to prod deps and run the compiled migrator instead.
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/types packages/types
COPY --from=build /app/apps/api apps/api

# The dependency tree is baked into the image and `node` cannot write to it, so
# pnpm must not try to re-install before running a script — which is what it
# does by default since pnpm 10. Image-only config: the host keeps the check.
RUN printf '\nverifyDepsBeforeRun: false\n' >> /app/pnpm-workspace.yaml \
 && corepack enable && corepack prepare --activate && chmod -R a+rX "$COREPACK_HOME"

# Everything the app reads is relative to the package root: `dist/main.js`,
# `drizzle/` for the migrator, and the `.env` cascade `shared/config` loads.
WORKDIR /app/apps/api
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]
