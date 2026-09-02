# 15: Local Docker Compose environment

**What to build:** A `docker compose up` that runs the API the same way the
deploy host does — a clean image built from a lockfile, no reuse of local
`node_modules` or stale `dist/` — plus a Postgres container to point
`DATABASE_URL` at. This catches the class of error that only shows up on a fresh
host (missing build step, stale `.tsbuildinfo`, dev-only dependency needed at
build time) before it reaches Render.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `apps/api/Dockerfile` — multi-stage: a build stage that runs `corepack enable`, `pnpm install --frozen-lockfile`, `pnpm --filter @olc/api build` from a clean checkout (no bind-mounted `node_modules`), and a slim runtime stage that runs `node dist/main.js`
- [ ] `docker-compose.yml` at the repo root with two services:
  - `db`: `postgres:16`, named volume, healthcheck, env for a local `olc` database
  - `api`: built from `apps/api/Dockerfile`, `env_file` the api `.env`, `depends_on` db healthy, port `3000` published
- [ ] `apps/api/.env.example` documents the compose `DATABASE_URL` (e.g. `postgresql://olc:olc@db:5432/olc`) and `DATABASE_URL_DIRECT`
- [ ] `docker compose run --rm api pnpm --filter @olc/api db:migrate` applies the Drizzle migrations to the `db` container
- [ ] `docker compose up --build` → `curl localhost:3000/health` returns `{"status":"ok"}`
- [ ] `.dockerignore` excludes `node_modules`, `dist`, `.git`, `.env`, test/coverage output
- [ ] README "Develop" section documents the compose workflow and that `docker compose build` is the pre-deploy check to run before opening a `dev → main` PR

## Notes

- Keep `web` out of compose for now — the Vite dev server in a container adds
  friction and the SPA deploys to Vercel, not Render. A future `--profile web`
  can add it.
- Optional follow-up (separate ticket): a CI job that runs `docker build
  apps/api` so the clean-build check runs on every PR, not just locally.
- Pairs with ticket 02's Drizzle/Neon setup: the compose `db` is the local
  stand-in for Neon, so `db:migrate` and the app run without a cloud database.
