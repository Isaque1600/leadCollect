# 04: Maps Source job — frontend

**What to build:** A signed-in user can run a Maps search from the UI. A search
form collects business type, city, state, and max results. Submitting it creates
a Job and switches to a progress view that polls `GET /jobs/:id` (~2s) and shows a
progress bar and the running counts. When the Job finishes, the view shows how
many Leads were collected. Errors surface as a message.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Search form with fields: business type, city, state, max results per source
- [ ] Submitting calls `POST /jobs` and navigates to the progress view for that job id
- [ ] Progress view polls `GET /jobs/:id` with TanStack Query and stops polling on `done` / `failed` / `cancelled`
- [ ] Progress bar derived from `queriesDone / queriesTotal`; counts for leads found and API calls used shown
- [ ] Terminal states show a clear summary or the error text
- [ ] Shared request/response types come from `packages/types`
