# 15: Local Docker Compose environment

**What to build:** A `docker compose up` that runs the API the same way the
deploy host does — a clean image built from a lockfile, no reuse of local
`node_modules` or stale `dist/` — plus a Postgres container to point
`DATABASE_URL` at. This catches the class of error that only shows up on a fresh
host (missing build step, stale `.tsbuildinfo`, dev-only dependency needed at
build time) before it reaches Render.

**Blocked by:** 01

**Status:** done (branch feature/15-local-docker-compose-env)

- [x] `apps/api/Dockerfile` — multi-stage: a build stage that runs `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm --filter @olc/api build` from a clean checkout (no bind-mounted `node_modules`), and a slim runtime stage that runs `node dist/main.js`
- [x] `docker-compose.yml` at the repo root with two services:
  - [x] `db`: `postgres:16`, named volume, healthcheck, env for a local `olc` database
  - [x] `api`: built from `apps/api/Dockerfile`, `env_file` the api `.env`, `depends_on` db healthy, port `3000` published
- [x] `apps/api/.env.example` documents the compose `DATABASE_URL` (e.g. `postgresql://olc:olc@db:5432/olc`) and `DATABASE_URL_DIRECT`
- [x] Migrations reach the `db` container — decided to run `pnpm --filter @olc/api db:migrate` from the host against `db`'s published `localhost:5432`, not `docker compose run` (see Notes: keeps the runtime image prod-pruned)
- [x] `docker compose up --build` → `curl localhost:3000/health` returns `{"status":"ok"}`
- [x] `.dockerignore` excludes `node_modules`, `dist`, `.git`, `.env`, test/coverage output
- [x] README "Develop" section documents the compose workflow and that `docker compose build` is the pre-deploy check to run before opening a `dev → main` PR

## Notes

- Verified end to end: `docker compose up --build` → `curl localhost:3000/health`
  returns `{"status":"ok","info":{},"error":{},"details":{}}`, and
  `docker compose run --rm api pnpm --filter @olc/api db:migrate` prints
  "migrations applied" and creates `users`, `jobs`, `leads`, `user_leads` in the
  `db` container.
- **The clean build immediately earned its keep:** the first `docker compose
  build` failed with `TS5083: Cannot read file '/app/tsconfig.base.json'` —
  `packages/types` extends a root config that nothing in `apps/api` references,
  so the image had not copied it. Exactly the class of fresh-host error the
  ticket is for.
- **Revised after review: migrations run on the host, not in the container** —
  `pnpm --filter @olc/api db:migrate` against `db`'s published
  `localhost:5432`, per `DATABASE_URL_DIRECT` in `.env.example`. That freed the
  runtime stage to be genuinely prod-only, so `docker compose run --rm api
  pnpm --filter @olc/api db:migrate` (and the `tsx`/`drizzle-kit` it needs) is
  gone from this image entirely.
- **Runtime stage does a second, filtered `pnpm install --prod`** rather than
  building once and pruning. First attempt was `pnpm prune --prod` on the build
  stage's tree: it does not reliably keep workspace-package symlinks — in
  testing, `apps/api/node_modules` came back empty, including `reflect-metadata`,
  a real runtime dependency (not a devDependency), and the app crashed on boot
  with `Cannot find module 'reflect-metadata'`. `pnpm install --prod
  --frozen-lockfile --filter "@olc/api..."` in a fresh runtime stage, copying
  only `dist/` from the build stage, is the standard pnpm-in-Docker pattern and
  does not have that failure mode.
- **`pnpm install`'s own caches have to be cleaned in the same `RUN`,** or they
  survive as dead weight in the layer: the content-addressable store
  (`pnpm store path`), `~/.cache/pnpm` (registry metadata), and
  `~/.cache/node/corepack` (the downloaded pnpm binary) together added ~470 MB
  invisible to `docker compose exec` (which runs as the unprivileged `node`
  user with no read access to `/root`) — only visible by inspecting the image
  as root. Removing all three in the install's own `RUN` line brought the final
  image from ~800 MB down to **414 MB**.
- The `verifyDepsBeforeRun: false` / pnpm-10-re-installs-before-scripts
  workaround from the first pass is gone too — it existed only to let
  `db:migrate` run as a `pnpm` script inside the container; the runtime image
  no longer runs any `pnpm` command at all (`CMD` is `node dist/main.js`
  directly).
- `apps/api/.env` (gitignored) is what compose reads via `env_file`; the boot
  validation requires the Google/JWT variables even for a `/health` check, so
  `.env.example` values are enough to bring the stack up.
- Keep `web` out of compose for now — the Vite dev server in a container adds
  friction and the SPA deploys to Vercel, not Render. A future `--profile web`
  can add it.
- Optional follow-up (separate ticket): a CI job that runs `docker build
  apps/api` so the clean-build check runs on every PR, not just locally.
- Pairs with ticket 02's Drizzle/Neon setup: the compose `db` is the local
  stand-in for Neon, so `db:migrate` and the app run without a cloud database.
