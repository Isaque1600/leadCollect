# 20: `GET /jobs` + the Jobs list screen

**What to build:** A signed-in user can see the Jobs they have run and open any
of them. `GET /jobs` returns that user's Jobs, newest first; a list screen
renders them with status, what was searched, and how many Leads were collected,
each linking to `/jobs/:jobId`.

**Blocked by:** 04, 21

**Status:** ready-for-agent

## Why

Ticket 04 shipped `/jobs/:jobId`, but a Job id is only reachable by starting a
Job or keeping the URL. Close the tab and a running Job becomes unreachable
even though the runner is still working and the Leads are still being
collected. Nothing lists a user's Jobs, so the work is effectively lost to them.

## API

- [ ] `GET /jobs` behind `JwtAuthGuard`, returning the requesting user's Jobs
      only — scoped by user id **in the query**, the same way `GET /jobs/:id`
      already is, not filtered after the fact
- [ ] Newest first (`created_at DESC`)
- [ ] Each item carries what the list needs to render without a second call:
      id, status, the search params (business type, city, state), the progress
      counters (`leadsFound`, `queriesDone`/`queriesTotal`), `createdAt`, and
      `error` when `failed`
- [ ] Paginated — a user accumulates Jobs indefinitely and this endpoint must
      not degrade. Limit + cursor (or limit + offset) is fine; pick one, state
      why in the PR, and keep the default page size modest
- [ ] Response type declared in `packages/types`, not redeclared in the SPA
- [ ] Unit tests: user scoping (another user's Jobs never appear), ordering,
      pagination boundaries

## SPA

- [ ] Jobs list screen at whatever route ticket 21 decided, rendering each Job
      with its status, search params, Lead count and start time
- [ ] Each row links to `/jobs/:jobId`
- [ ] Empty state for a user who has never run a Job, pointing at the search form
- [ ] A Job still `running` is visibly distinguishable from a terminal one; the
      list does not need to poll (opening the Job does that already) — say so
      explicitly in the PR if you decide otherwise
- [ ] Uses the TanStack Query setup ticket 04 established, and the existing
      `apiFetch`/401 path — no new fetching pattern

## Notes

- The `jobs` table already carries everything this endpoint needs (status,
  `jsonb` params, progress counters, error, timestamps) — this should be a read
  model over existing columns, not a schema change.
- `GET /jobs/:id` answers 404 rather than 403 for another user's Job so ids
  can't be probed. Keep that behaviour consistent here: a user simply never
  sees Jobs that aren't theirs.
- Ticket 09 adds cancellation and the one-running-Job-per-user rule. If a
  cancel control belongs on the list rather than only the Job view, that is
  09's call, not this ticket's — don't build it here.
