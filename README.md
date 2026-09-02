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
