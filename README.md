# Online Lead Collector

Multi-user web app that finds business leads from Google Maps and web search,
enriches them from company websites, and exports them as Excel.

See `CONTEXT.md` for the glossary, `docs/adr/` for architecture decisions, and
`.scratch/online-lead-collector/` for the ticket breakdown.

## Layout

| Path | What |
| --- | --- |
| `apps/api` | NestJS API (`@olc/api`) |
| `apps/web` | React + Vite SPA (`@olc/web`) |
| `packages/types` | Shared TypeScript types (`@olc/types`) |
| `legacy/` | The original Python CLI, kept for reference until the port is done (ADR-0004) |

## Develop

```bash
pnpm install
pnpm --filter @olc/types build   # build shared types once (and after changing them)
pnpm dev                         # runs api (:3000) and web (:5173) in parallel
```

Copy `apps/api/.env.example` → `apps/api/.env` and `apps/web/.env.example` →
`apps/web/.env` as needed.

### Docker Compose — the API the way the deploy host runs it

`docker-compose.yml` runs the API from a clean image built out of the lockfile
(no host `node_modules`, no stale `dist/`) plus a `postgres:16` container that
stands in for Neon. The SPA stays on the host — it deploys to Vercel, not Render.

```bash
cp apps/api/.env.example apps/api/.env   # DATABASE_URL=postgresql://olc:olc@db:5432/olc
docker compose up --build                # db + api, api on :3000
curl localhost:3000/health               # {"status":"ok",...}
docker compose down                      # add -v to drop the database volume
```

The `api` image is prod-only (a second, filtered `pnpm install --prod` in the
runtime stage — `pnpm prune --prod` was tried first but does not reliably keep
workspace-package symlinks, see the Dockerfile comment), so it carries no
`tsx`/`drizzle-kit` to run migrations with. `db` is also published on
`localhost:5432` — run migrations from the host instead, against the same
database:

```bash
DATABASE_URL_DIRECT=postgresql://olc:olc@localhost:5432/olc \
  pnpm --filter @olc/api db:migrate
```

**`docker compose build` is the pre-deploy check.** Run it before opening a
`dev → main` PR: it is the only local check that starts from a bare checkout, so
it catches what a warm workspace hides — a missing build step, a stale
`.tsbuildinfo`, a file needed at build time that the image never copied, a
dependency that only resolves because it is installed on the host.

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

CI runs all four on every PR.

## Deploy

Two isolated environments, each tracking a branch — see
[ADR-0007](docs/adr/0007-dev-prod-environments.md).

| Env | API (Render) | branch | SPA (Vercel) | DB (Neon) |
| --- | --- | --- | --- | --- |
| dev | `olc-api-dev` | `dev` | preview deploys | dev database |
| prod | `olc-api` | `main` | production | prod database |

`render.yaml` defines both API services. Promotion is a `dev → main` PR.
