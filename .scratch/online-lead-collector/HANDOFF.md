# Handoff — Online Lead Collector

Written 2026-09-02. Read this first when resuming; it points at everything else.

## What the project is

A multi-user web app that takes an existing Python lead-collector CLI online.
Users sign in with Google, run a search against Google Maps and/or Serper web
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
- Both Neon databases have their `users` table (migrated by hand on
  2026-09-02, before ticket 16). From ticket 16 on, each Render deploy runs its
  own migrations (`apps/api/scripts/start.sh`).

### Tickets

| # | Title | Status |
| --- | --- | --- |
| 01 | Walking skeleton | done |
| 02 | Google login | done (merged, PR #2) |
| 03 | Maps source job backend | done (merged, PR #5) |
| 04 | Maps source job frontend | done (merged, PR #7) |
| 05 | Enrichment + Stale Lead refresh | done (merged, PR #8, 2026-09-30) — owner decisions open, see below |
| 06–10 | Serper source, Lead Pool, quota, cancel/reaper, xlsx export | ready-for-agent |
| 11 | GitHub repo + push | done |
| 12 | Deploy API to Render | done |
| 13 | Deploy SPA to Vercel | done |
| 14 | Explicit CI steps | done |
| 15 | Local Docker Compose env | done (merged, PR #6) |
| 16 | Migrations on deploy | done (merged, PR #9, 2026-09-30) — first real deploy not yet verified |
| 17 | OpenAPI docs via @nestjs/swagger | in review (PR #11) — rebase onto #10 pending |
| 18 | SPA routing, protected routes, app shell | done (merged, PR #4) |
| 19 | POST code exchange for token delivery | in review (PR #10) — rebased 2026-09-30, migration now `0003` |
| 20 | Jobs list | ready-for-agent |
| 21 | SPA route map decision | ready-for-human |

### Merged 2026-09-30: PR #9 (ticket 16) and PR #8 (ticket 05)

Merged into `dev` in that order (`51352bb`, `24614c0`). Not on `main` yet.

**PR #9: migrations run on every deploy.**

- Both Render services now start through `apps/api/scripts/start.sh`
  (`render.yaml` `startCommand: sh scripts/start.sh`). It runs `pnpm run
  db:migrate` against `DATABASE_URL_DIRECT`, then `exec node dist/main.js`.
- If a migration fails, the script exits non-zero and the server never starts.
  The health check fails, so Render keeps the previous version serving.
- The old version keeps serving while the new one migrates. A migration must
  stay compatible with the code it replaces.
- `tsx` (a devDependency) runs the migrator in production. That works because
  Render's build installs devDependencies and does not prune them. **Never set
  `NODE_ENV=production` on Render:** it breaks both the build and the migration.
- Every cold start on the free plan runs the migrator, which adds about 1–2 s.
  If Neon is unreachable when the service wakes, the service does not start at
  all, even though `/health` is liveness-only (ADR-0008). This is an accepted
  trade-off.
- Two migrations that share a number (two `0002_*`) must never be hand-merged.
  Drizzle's migrator skips any migration whose journal `when` is older than the
  newest applied one, so a hand-merged journal can "deploy successfully" while
  silently skipping a migration. Whichever PR lands second reruns
  `pnpm --filter @olc/api db:generate` after rebasing. PR #10 was fixed this way.

**PR #8: Enrichment + Stale Lead refresh.**

- New `enrichment` module (`jobs → enrichment → leads`). It ports the
  email/WhatsApp/phone regexes and the `robots.txt` check from
  `collector_maps.py`. It visits a Lead's site during the Job if the Lead has
  never been enriched, and in the background (not awaited) if it is a Stale Lead
  (older than 30 days).
- Migration `0002_enrichment` adds the nullable `leads.enriched_at`. There are
  no new env vars, dependencies or config.
- Phone precedence: site WhatsApp → Places `nationalPhoneNumber` → phone found
  on the site → the stored phone. This order also holds on re-Enrichment; the
  review round fixed that.
- The site fetcher is fenced against SSRF. It allows only http(s), and refuses
  loopback, private, link-local/metadata, CGNAT, ULA and NAT64 addresses. It
  checks at DNS lookup time and again on every redirect hop (at most 5
  redirects). It also caps the body at 2 MB, decompressed.
- `robots.txt`: 401/403 disallow everything, any other 4xx allows, and 5xx
  allows (CPython disallows on 5xx).
- An awaited inline Enrichment can take about 21 s per new Lead in the worst
  case (two 10 s timeouts plus 2 × 500 ms). Keep that in mind for ticket 09's
  15-minute reaper.

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

### From PRs #9 and #8 (merged into `dev` 2026-09-30)

1. **Check that `DATABASE_URL_DIRECT` is set on `leadCollect-Dev`** in the Render
   dashboard. `render.yaml` declares it `sync: false`, and migrations used to run
   from a local env file, so the dashboard value may be missing. If it is
   missing, the deploy fails and the previous version keeps serving.
2. **Verify the first migrate-on-deploy on `leadCollect-Dev`** (ticket 16's last
   open criterion). The `24614c0` deploy log should show `migrations applied`
   before the server starts. `0002_enrichment` should be applied, so Neon dev's
   `leads` table should now have an `enriched_at` column. `/health` returned 200
   on 2026-09-30, but that does not show which commit is running.
3. **Before the next `dev → main` PR:** set `DATABASE_URL_DIRECT` on
   `leadCollect-Prod` as well. That deploy applies `0002_enrichment` (plus
   `0003_auth_exchange_codes` if PR #10 has landed) to Neon prod by itself.
   Nothing needs running by hand.
4. **Owner decisions left open by PR #8** (ticket 05):
   - Keep the hand-rolled `robots.txt` parser (`enrichment/domain/robots-txt.ts`),
     or swap it for the `robots-parser` npm package?
   - Should a 5xx `robots.txt` disallow everything, as CPython does? Today it
     allows.
   - When every source has dropped a Lead's phone, should the stored phone still
     be kept (the `?? phone` fallback)? Today it is kept.
5. **Optional follow-ups from the PR #8 review** (not tickets yet):
   - Block 6to4 (`2002::/16`) and Teredo (`2001::/32`) in
     `enrichment/infra/public-address.ts`.
   - Add a committed integration test that drives the real `HttpWebsiteFetcher`
     into Postgres. Today the integration suite uses a scripted fetcher.
   - Decode stacked `Content-Encoding` (`gzip, br`) and raw deflate. Today those
     pages come back unreadable, which fails safe.
6. **Optional follow-ups from the PR #9 review:**
   - Set `onnotice` in `src/shared/db/migrate.ts` to silence the two `NOTICE …
     already exists, skipping` lines on every run.
   - Document the cold-start trade-off (Neon down at wake means no service) in the
     README deploy section.

### Older tidy-up

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
switches to local Postgres once ticket 15 lands; the prod one is no longer needed
for migrations: since ticket 16, each Render deploy applies its own.

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
