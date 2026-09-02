# 03: Maps Source job — backend

**What to build:** Through the API alone (no UI yet), a signed-in user can start a
Job that searches the Maps Source and collects Leads. `jobs`, `leads`, and
`user_leads` tables exist. The Google Places search + details logic is ported
from `collector_maps.py` into a `MapsSource`. An in-process job runner picks up a
new Job, composes queries from the structured params, calls the Maps Source,
upserts each result into the Lead Pool deduped on `place_id` (the Lead Identity),
and links it to the user as a Collected Lead. Job status and progress are written
to the `jobs` row. No Enrichment yet — Leads carry only what Places returns.

**Blocked by:** 02

**Status:** done (branch `feature/03-maps-source-job-backend`)

- [x] `jobs` (id, user_id, status, params, progress fields, error, timestamps), `leads`, `user_leads` tables via migration
- [x] `leads` has a unique constraint on `place_id`; `user_leads` unique on `(user_id, lead_id)`
- [x] `MapsSource` ports `places:searchText` + place-details calls from the Python script
- [x] `POST /jobs` accepts `{ businessType, city, state, maxResults }` and returns a job id with status `queued`
- [x] The runner composes a query like `{businessType} em {city} {state}`, runs it, and moves the Job through `running` → `done`
- [x] Each result is upserted into the Lead Pool by `place_id`; existing Leads are reused, not duplicated
- [x] A `user_leads` row links every collected Lead to the requesting user
- [x] `GET /jobs/:id` returns `{ status, queriesTotal, queriesDone, leadsFound, apiCallsUsed, currentStep, error }`
- [x] A user can only read their own Jobs
- [x] Unit tests: query composition, `place_id` dedup/upsert. Integration test: full Job with the Places API mocked

## Notes

- Two modules, not one: `modules/leads/` owns the Lead Pool (`leads`,
  `user_leads`) and `modules/jobs/` owns the `jobs` row, the in-process runner
  and the Maps Source. `JobsModule` imports `LeadsModule` for the `LEAD_POOL`
  port; the dependency never points back.
- **Request validation adopts `class-validator` + `class-transformer`** behind
  Nest's own global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`,
  `transform`), rather than hand-rolled checks. This is the first DTO in the
  codebase, so it sets the convention for every later ticket — and it is what
  `@nestjs/swagger` (ticket 17) reads to document request bodies.
- No queue package. ADR-0003 already decided in-process, so
  `StartMapsJobUseCase` persists the `queued` row and calls `JobRunner.run`
  without awaiting it; `run` never rejects, it writes `failed` + the error text
  onto the Job row. `@nestjs/schedule` will earn its place in ticket 09 (reaper),
  not here.
- `jobs.status` is `text` with the union narrowed in TypeScript rather than a
  `pgEnum`, so ticket 09 adding `cancelled` is not an `ALTER TYPE`.
- `leads.place_id` is nullable-unique so ticket 06 can store Web Search Leads
  keyed on normalized domain in the same table.
- Cross-module foreign keys (`jobs.user_id`, `user_leads.user_id` → identity's
  `users`) import the `users` table object, because that is the only way Drizzle
  expresses an FK. Flagged as a convention worth confirming.
- New env var `GOOGLE_PLACES_API_KEY`: typed namespace in
  `shared/config/places.config.ts`, required in `env.validation.ts` (boot fails
  when missing or blank), documented in `.env.example`.
- Migration `drizzle/0001_jobs_leads_user_leads.sql` is generated and committed
  but **not applied** — a human must run `pnpm --filter @olc/api db:migrate`
  per environment.
- The integration test needs a real Postgres (ticket 15) and skips unless
  `DATABASE_URL_TEST` is set, matching how `vitest.integration.config.ts` is
  already scoped out of CI.
- Deliberately left to ticket 09: the one-running-Job-per-user 409, cancellation,
  and the stuck-Job reaper. Left to ticket 05: Enrichment, so `leads.email` stays
  null and there is no `enriched_at` column yet. Left to ticket 07: the
  cache-first Pool lookup and the columns it will need to match on (city, state,
  normalized query text).
- Not done: `user_leads` has no `job_id`, so ticket 10's "export *that Job's*
  Collected Leads" has nothing to filter on yet. See the question in the PR.
