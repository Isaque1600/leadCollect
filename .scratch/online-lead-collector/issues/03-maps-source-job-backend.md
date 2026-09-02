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

**Status:** ready-for-agent

- [ ] `jobs` (id, user_id, status, params, progress fields, error, timestamps), `leads`, `user_leads` tables via migration
- [ ] `leads` has a unique constraint on `place_id`; `user_leads` unique on `(user_id, lead_id)`
- [ ] `MapsSource` ports `places:searchText` + place-details calls from the Python script
- [ ] `POST /jobs` accepts `{ businessType, city, state, maxResults }` and returns a job id with status `queued`
- [ ] The runner composes a query like `{businessType} em {city} {state}`, runs it, and moves the Job through `running` → `done`
- [ ] Each result is upserted into the Lead Pool by `place_id`; existing Leads are reused, not duplicated
- [ ] A `user_leads` row links every collected Lead to the requesting user
- [ ] `GET /jobs/:id` returns `{ status, queriesTotal, queriesDone, leadsFound, apiCallsUsed, currentStep, error }`
- [ ] A user can only read their own Jobs
- [ ] Unit tests: query composition, `place_id` dedup/upsert. Integration test: full Job with the Places API mocked
