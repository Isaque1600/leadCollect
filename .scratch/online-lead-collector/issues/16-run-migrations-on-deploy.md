# 16: Run database migrations on deploy

**What to build:** Drizzle migrations apply automatically when the API deploys, so
a schema change ships with the code that needs it instead of a manual step.

For now migrations are run by hand (`pnpm --filter @olc/api db:migrate` against
each environment's `DATABASE_URL_DIRECT`). This ticket automates it.

**Blocked by:** 02

**Status:** ready-for-agent (low priority — manual is fine until schema changes get frequent)

- [ ] Migrations run on every deploy of each Render service, before the new version serves traffic
- [ ] Idempotent and safe to run on restart (Drizzle's migrator already is)
- [ ] Works on Render's **free** plan — the "Pre-Deploy Command" is paid-only, so the likely approach is a start wrapper: `pnpm --filter @olc/api db:migrate && pnpm --filter @olc/api start`, or a small `start.sh`
- [ ] A failed migration fails the deploy (does not start the server against a half-migrated database)
- [ ] `render.yaml` updated for both services; documented in the README deploy section
- [ ] Ticket 12's note about running migrations by hand is removed once this lands

## Notes

- Single free instance per environment, so there is no migration race between instances.
- If Render plans change later, switch to a proper Pre-Deploy Command and drop the start wrapper.
