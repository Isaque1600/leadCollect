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
| dev | `leadCollect-Dev` — https://leadcollect-dev.onrender.com | `dev` | preview deploys | dev database |
| prod | `leadCollect-Prod` — https://leadcollect-prod.onrender.com | `main` | production | prod database |

Render serves apps from `onrender.com`; `render.com` is the dashboard.

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

- **Sign-in works end to end in both environments** (verified 2026-09-02).
- `main` is at the merge of PR #3 — auth + the ADR-0008 API. Both Neon
  databases are migrated; both Render services send the correct
  `redirect_uri`.
- **`dev` has auth.** PR #2 merged 2026-09-02 (`c01721a`), carrying Google
  sign-in *and* the ADR-0008 restructure of `apps/api`. `dev` is therefore well
  ahead of `main`; the next `dev → main` PR is a big one.
- Render's `leadCollect-Dev` auto-deploys from `dev`, so the dev API is the
  first environment to run the new config validation.
- Both Neon databases have their `users` table (migrations run by hand,
  2026-09-02).

### Tickets

| # | Title | Status |
| --- | --- | --- |
| 01 | Walking skeleton | done |
| 02 | Google login | done (merged, PR #2) |
| 03–10 | Maps job, enrichment, Brave source, Lead Pool, quota, cancel/reaper, xlsx export | not started |
| 11 | GitHub repo + push | done |
| 12 | Deploy API to Render | done |
| 13 | Deploy SPA to Vercel | done |
| 14 | Explicit CI steps | done |
| 15 | Local Docker Compose env | not started |
| 16 | Migrations on deploy | not started (low priority) |
| 17 | OpenAPI docs via @nestjs/swagger | not started |
| 18 | SPA routing, protected routes, app shell | ready-for-agent — blocks 04 |
| 19 | POST code exchange for token delivery | ready-for-agent — do after 18 |

## What the API looks like now (landed in PR #2)

`apps/api` is built to ADR-0008. The old flat `auth/` + `db/` + `health/` are gone:

| Now | Holds |
| --- | --- |
| `src/modules/identity/domain/` | `User`, `GoogleIdentity`, the pure `profileHasChanged` rule, and the `Users` port (`USERS` token) |
| `src/modules/identity/application/` | `SignInWithGoogle` use-case, `TokensService` |
| `src/modules/identity/api/` | `auth.controller`, `google.strategy`, `jwt-auth.guard`, `@CurrentUser()` |
| `src/modules/identity/infra/` | `drizzle-users.repository`, module-owned `identity.schema.ts` |
| `src/modules/health/` | Terminus liveness only, `check([])`, no DB indicator |
| `src/shared/config/` | `@nestjs/config`, four `registerAs` namespaces read as `ConfigType`, `env.validation.ts` as the `validate` hook |
| `src/shared/db/` | `db.module` (drains the pool on `OnApplicationShutdown`), `migrate.ts` |
| `src/schema.ts` | composition-root merge of the module-owned Drizzle schemas; `drizzle.config.ts` globs `src/modules/**/*.schema.ts` |
| `test/unit/<module>/<layer>/` | 23 unit tests, up from 9 |

Verified: `shared/` imports nothing from `modules/`, `domain/` imports nothing
from `infra/`, and there is no stringly-typed `ConfigService.get()` anywhere.
New first-party deps, both named in ADR-0008: `@nestjs/config`,
`@nestjs/terminus`.

### Review findings from PR #2 — all closed

- ~~**Blocker** — no `.env` loading~~ → `shared/config` loads
  `.env.<NODE_ENV>.local` then `.env`. The API boots locally again.
- ~~`JWT_SECRET` never checked for non-empty~~ → `env.validation.ts` requires
  every secret non-blank, `JWT_SECRET` ≥16 chars, `PORT` a positive integer, and
  reports all problems at once at boot.
- ~~No test for `GoogleStrategy.validate`'s no-email branch, or the controller~~
  → both covered, plus the displayName fallback and the `GET /me` path.
- ~~The `makeDb` thenable mock~~ → replaced by an in-memory `Users` fake.
- **Still open, deliberately:** the token is handed to the SPA in a URL fragment.
  The POST code exchange that hardens it is now **ticket 19**, to be done after
  ticket 18 lands `/auth/callback`.

### Worth knowing about the merged code

- `apps/api/tsconfig.spec.json` is new. `tsconfig.json` still drives `nest build`
  (`include: ["src"]`); `typecheck` now also runs the spec project so `test/` is
  typechecked.
- `db:migrate` uses Node's own `--env-file-if-exists=.env.${NODE_ENV:-development}.local`
  — no dotenv dependency, but POSIX-shell only.
- `TokensService` sits in `application/` rather than behind a `domain/` port with
  an `infra/` JWT adapter. One implementation did not seem to justify the
  ceremony; easy to invert later.
- `JwtAuthGuard` kept its name.

## Next steps

1. Finish wiring sign-in end to end (see the human actions below) and click
   through it on the dev environment.
2. Then ticket 03 (Maps source job backend) is the next implementation ticket.
   Ticket 18 (SPA routing) now blocks 04 and can run in parallel with 03;
   15 and 17 are independent and can go any time.
3. Ticket 19 (token hardening) after 18.

## Outstanding human actions

Nothing blocking — auth is live in both environments. What is left is tidy-up:

1. **Two stale agent worktrees** under `.claude/worktrees/`
   (`agent-a38fb8837fc74fe8b`, `agent-ac228d1989b458fd6`) still hold old
   checkouts. `git worktree remove --force <path>` then `git worktree prune`.
2. Optional tidy: align `leadCollect-Dev`'s Render build/start commands with
   prod's (add `corepack enable`, use `&&` not `;`).

Done 2026-09-02: the trailing slash on `WEB_APP_URL` (fixed on both Render
services) and the duplicate deploy-hook copies in the `Preview` / `Production`
GitHub environments (deleted). Note `app.config.ts` still does not normalise a
trailing slash, so the env var is the only thing keeping the sign-in redirect
correct — a one-line strip there would make it structural.

### Gotchas learned the hard way (2026-09-02)

- Render serves apps from **`onrender.com`**; `render.com` is the dashboard.
  A `GOOGLE_CALLBACK_URL` on the wrong domain (or on `http`) gives Google's
  `Error 400: redirect_uri_mismatch`, which does not say which side is wrong.
- Check what a service actually sends without opening a browser:
  `curl -sD - https://<host>/auth/google -o /dev/null | grep -i location`
- Vercel deploy hooks must be **repository** secrets. An environment secret is
  invisible to a job that declares no `environment:`, and `deploy-web` does not.
- The dev Vercel alias sits behind Deployment Protection — it 302s to
  `vercel.com/sso-api`, so only a logged-in browser can load it.

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
