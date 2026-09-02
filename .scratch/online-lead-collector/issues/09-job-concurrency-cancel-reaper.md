# 09: Job concurrency, cancel, reaper

**What to build:** A user can have only one running Job at a time — starting
another while one runs is rejected with a clear "job already running" response and
the UI points them at the running Job. The progress view has a Cancel button; the
runner checks a cancellation flag between queries, stops promptly, marks the Job
`cancelled`, and keeps the Leads collected so far. A reaper marks any Job that has
been running longer than 15 minutes as `failed` so a crashed or restarted
instance cannot leave a Job stuck forever.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `POST /jobs` returns 409 with the running job's id when the user already has one running
- [ ] SPA surfaces the 409 and links to the running Job's progress view
- [ ] `POST /jobs/:id/cancel` sets a flag; the runner checks it between queries and stops
- [ ] A cancelled Job ends in status `cancelled` with its partial Collected Leads intact
- [ ] A scheduled reaper transitions Jobs `running` for >15 min to `failed` with an explanatory error
- [ ] Unit tests: concurrency guard, cancel-between-queries, reaper age threshold
