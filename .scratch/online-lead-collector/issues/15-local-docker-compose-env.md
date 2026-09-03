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
- [x] `docker compose run --rm api pnpm --filter @olc/api db:migrate` applies the Drizzle migrations to the `db` container
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
- **Runtime stage keeps the API's devDependencies (image ~800 MB).** The
  acceptance criteria want both a slim runtime stage *and* `docker compose run
  --rm api pnpm --filter @olc/api db:migrate`, and those pull in opposite
  directions: `db:migrate` runs the TypeScript migrator through `tsx`, a
  devDependency. The runtime stage therefore copies the built tree from the
  build stage instead of doing a `--prod` install: slim base image, no build
  toolchain, non-root, `node dist/main.js` — but not pruned. This image is a
  local fixture, not the deploy artifact (Render builds from source per
  `render.yaml`), so size was the cheaper thing to give up. A prod-pruned image
  would need migrations run from compiled output (`node
  dist/shared/db/migrate.js`) — worth doing if this image ever ships, and
  relevant to ticket 16.
- pnpm 10+ re-installs dependencies before running a script; in an image whose
  `node_modules` the `node` user cannot write, that fails with `EACCES`. The
  runtime stage appends `verifyDepsBeforeRun: false` to the image's copy of
  `pnpm-workspace.yaml` (image-only — the host keeps the check). The equivalent
  `.npmrc` key and `npm_config_*` env var are both ignored by pnpm 11.
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
