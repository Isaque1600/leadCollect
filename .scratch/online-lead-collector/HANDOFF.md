# Handoff — Online Lead Collector

Written 2026-09-02. Read this first when resuming; it points at everything else.

## What the project is

A multi-user web app that takes an existing Python lead-collector CLI online.
Users sign in with Google, run a search against Google Maps and/or Brave web
search, and download the Leads they collected as an Excel file. A shared **Lead
Pool** minimises paid API calls; a per-user **Quota** caps spend.

Read `CONTEXT.md` for the glossary (Lead, Lead Pool, Collected Lead, Lead
Identity, Job, Source, Enrichment, Stale Lead, Quota, Billable Call, User) and
use those terms. Decisions live in `docs/adr/0001`–`0008`.

## Repo shape

| Path | What |
| --- | --- |
| `apps/api` | NestJS API (`@olc/api`) |
| `apps/web` | React + Vite SPA (`@olc/web`) |
| `packages/types` | Shared TypeScript types (`@olc/types`) |
| `legacy/` | The original Python CLI — reference only, being replaced (ADR-0004) |
| `.scratch/online-lead-collector/` | Spec + tickets (this is the issue tracker) |

## Deployment

Two isolated environments, each tracking a branch (ADR-0007):

| Env | API (Render) | branch | SPA (Vercel) | DB (Neon) |
| --- | --- | --- | --- | --- |
| dev | `leadCollect-Dev` | `dev` | preview deploys | dev database |
| prod | `leadCollect-Prod` | `main` | production | prod database |

Both hosts auto-deploy, gated on CI: Render waits for the GitHub check; Vercel's
push-deploys are disabled for `main`/`dev` in `apps/web/vercel.json` and fired
instead by the `deploy-web` job in `.github/workflows/ci.yml` via deploy-hook
secrets (`VERCEL_DEPLOY_HOOK_MAIN` / `_DEV`).

## Git workflow (enforced, not just convention)

- **Never push to `main`.** It only advances through merged PRs. Direct pushes
  and force-pushes are blocked by the sandbox.
- `dev` is the integration branch. Small config/doc changes go straight to `dev`.
- Implementation work goes on `feature/NN-<slug>` cut from `dev`, landing via a
  PR into `dev`. The `feature-builder` subagent does this end to end.
- The human opens the `dev → main` PR.
- `main`'s ruleset requires a PR + passing checks, with required approvals set to
  0 (solo maintainer).

## Current state

- `main` is at the merge of PR #1 — walking skeleton + all infra, **no auth**.
- `dev` is ahead with the architecture decisions (ADR-0008) and agent rules.
- **PR #2** (`feature/02-google-login → dev`) is **open and not mergeable yet**.

### Tickets

| # | Title | Status |
| --- | --- | --- |
| 01 | Walking skeleton | done |
| 02 | Google login | in review (PR #2) — needs the restructure below |
| 03–10 | Maps job, enrichment, Brave source, Lead Pool, quota, cancel/reaper, xlsx export | not started |
| 11 | GitHub repo + push | done |
| 12 | Deploy API to Render | done |
| 13 | Deploy SPA to Vercel | in progress — confirm prod SPA reaches prod API now PR #1 is merged |
| 14 | Explicit CI steps | done |
| 15 | Local Docker Compose env | not started |
| 16 | Migrations on deploy | not started (low priority) |
| 17 | OpenAPI docs via @nestjs/swagger | not started |

## The immediate next task: restructure PR #2 to ADR-0008

The API architecture was designed but **not yet built**. `feature/02-google-login`
still has the old flat `auth/` + `db/` layout. One pass on that branch:

1. Merge `dev` in. Brings the `@olc/types` build fix and ADR-0008. Two known
   conflicts: `apps/api/package.json` (scripts block) and
   `.scratch/.../02-google-login.md` (Status line — resolve to "done").
2. `auth/` + `db/` → `modules/identity/` + `shared/db/`. Split `AuthService`
   into a `SignInWithGoogle` use-case, a tokens module, and a `Users` port with
   a Drizzle adapter.
3. `shared/config/` using **`@nestjs/config`** (`registerAs` + `ConfigType`, not
   stringly-typed `get()`). This closes the outstanding blocker: nothing
   currently loads `apps/api/.env*`, so the API cannot boot locally.
4. `health` via **`@nestjs/terminus`**, liveness only (no DB indicator — see
   ADR-0008 for why).
5. All specs move to `test/unit/<module>/<layer>/<name>.<kind>.spec.ts`; delete
   the health spec; split the vitest configs; add `test:integration`.
6. Verify green (`lint`, `typecheck`, `test`, `build`), push — PR #2 updates in
   place.

### Review findings on PR #2 still to address

- **Blocker** — no `.env` loading (fixed by step 3 above).
- `JWT_SECRET` is never checked for being non-empty.
- Token is handed to the SPA in a URL fragment; documented tradeoff, a POST code
  exchange is the hardening path.
- No test for `GoogleStrategy.validate`'s no-email branch, or the controller.
- The `makeDb` thenable mock in `auth.service.spec.ts` dies with step 2.

## Outstanding human actions

1. Confirm the prod SPA now reaches the prod API (ticket 13's last box).
2. Before auth can actually run: create the **Google OAuth app** (scopes
   `openid email profile`), set `JWT_SECRET`, `GOOGLE_*`, `WEB_APP_URL` on both
   Render services, and run `pnpm --filter @olc/api db:migrate` per environment.
   Neon databases and their env vars are already done.
3. Optional tidy: align `leadCollect-Dev`'s Render build/start commands with
   prod's (add `corepack enable`, use `&&` not `;`).

Local env files are `apps/api/.env.development.local` and
`.env.production.local` (gitignored). The dev one points at Neon dev for now and
switches to local Postgres once ticket 15 lands; the prod one exists only to run
migrations against the prod database until ticket 16 automates it.

## Working rules for agents

- **ADR-0008** governs `apps/api`: modular monolith, one folder per module under
  `src/modules/` with `domain/ application/ api/ infra/`, `shared/` only for what
  two or more modules use, `shared/` never imports from `modules/`, NestJS's
  `@Module` as the seam, module-owned Drizzle schemas found by glob.
- **Check NestJS before hand-rolling** any API plumbing — installed `@nestjs/*`
  packages first, then the docs. If unsure whether Nest solves it, **ask**; don't
  silently hand-roll and don't silently adopt a package either.
- **Ask, don't guess.** A subagent that hits an unresolvable decision ends its
  run with the question stated plainly.
- Both rules are in `CLAUDE.md` and `.claude/agents/feature-builder.md`.
