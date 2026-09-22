# 16: Run database migrations on deploy

**What to build:** Drizzle migrations apply automatically when the API deploys, so
a schema change ships with the code that needs it instead of a manual step.

Before this ticket, migrations were run by hand (`pnpm --filter @olc/api db:migrate`
against each environment's `DATABASE_URL_DIRECT`). This ticket automates it.

**Blocked by:** 02

**Status:** done (branch feature/16-migrate-on-deploy, PR #9 https://github.com/Isaque1600/leadCollect/pull/9) — deploy verification on `leadCollect-Dev` pending, done by the user

- [x] Migrations run on every deploy of each Render service, before the new version serves traffic
- [x] Idempotent and safe to run on restart (Drizzle's migrator already is)
- [x] Works on Render's **free** plan — the "Pre-Deploy Command" is paid-only, so the likely approach is a start wrapper: `pnpm --filter @olc/api db:migrate && pnpm --filter @olc/api start`, or a small `start.sh`
- [x] A failed migration fails the deploy (does not start the server against a half-migrated database)
- [x] `render.yaml` updated for both services; documented in the README deploy section
- [x] Ticket 12's note about running migrations by hand is removed once this lands

## Notes

- Single free instance per environment, so there is no migration race between instances.
- If Render plans change later, switch to a proper Pre-Deploy Command and drop the start wrapper.
- Implemented as `apps/api/scripts/start.sh` (POSIX sh), Render's
  `startCommand` for both services (`sh scripts/start.sh`). It runs
  `pnpm run db:migrate`. If that fails, it exits with the same code and never
  starts the server. Otherwise it `exec`s `node dist/main.js`, so Render's
  SIGTERM reaches Node. Tests: `apps/api/test/unit/scripts/start.spec.ts`,
  using stand-in commands passed in through `MIGRATE_CMD`/`START_CMD`.
- The start default is `node dist/main.js`, the body of `pnpm start`, rather
  than `pnpm start` itself, so there is no pnpm process between the signal and
  Node.
- `tsx` (a devDependency, used by `db:migrate`) is available at runtime:
  Render's build installs devDependencies (`nest build` already needs
  `@nestjs/cli`) and does not prune them. No change was needed.
- `DATABASE_URL_DIRECT` was already declared `sync: false` on both services in
  `render.yaml`. It must hold a value in both Render dashboards.
- Ticket 12's file had no migration note. The "run by hand" notes were in
  `HANDOFF.md`, and they are updated.
- Not verified on Render yet: the user checks the first real deploy to
  `leadCollect-Dev`.
