# 07: Lead Pool cache-first lookup

**What to build:** A Job spends Billable Calls only on what the Lead Pool does not
already have. Before calling any Source, the runner matches the Pool by business
type, location, and query text, links every match to the user as a Collected Lead
immediately, and then calls the Sources only for the remaining shortfall
(`maxResults` minus Pool hits). The progress payload distinguishes Pool hits from
freshly fetched Leads.

**Blocked by:** 06

**Status:** ready-for-agent

- [ ] Pool match query on `tipo_negocio` + city/state + normalized query text
- [ ] Matched Leads are linked via `user_leads` without any Source call
- [ ] Sources are called only for `max(0, maxResults - poolHits)` per Source
- [ ] Stale matched Leads still trigger background re-enrichment (from ticket 05)
- [ ] `GET /jobs/:id` progress separates `leadsFromPool` and `leadsFetched`
- [ ] Unit tests: shortfall calculation, match query. Integration test: second identical Job makes zero Billable Calls
