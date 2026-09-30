# 06: Web Search Source (Serper)

**What to build:** A Job can also search the Web Search Source. A `SearchProvider`
interface abstracts the search API, with a Serper.dev implementation behind it
(ADR-0005). The search form gains source checkboxes (Google Maps, Web search); the
user can pick either or both. Web results become Leads: name from the result
title, site from the URL, `fonte` = "Busca Web", `link_origem` = the result URL, no
`place_id`. Their Lead Identity is the normalized website domain, deduped against
the Lead Pool. Web Search Leads flow through the same Enrichment pipeline.

**Blocked by:** 05

**Status:** ready-for-agent

**Swappability is the point of the seam.** Follow the `MapsSource` pattern in
`modules/jobs/`: a port and injection token in `domain/`, the vendor class in
`infra/`, bound with `useClass` in `jobs.module.ts`. Changing vendor must mean
writing one new `infra/` class, one config namespace, and changing one provider
binding — nothing in `application/` or `domain/`. So:

- The port speaks our language, not Serper's: e.g.
  `search(query: string, maxResults: number): Promise<WebSearchHit[]>` with
  `WebSearchHit = { url: string; title: string }`. Location/language (Serper's
  `gl=br`, `hl=pt-br`) are the implementation's concern, not parameters every
  vendor must understand.
- Serper's payload shape, pagination (`page`), and auth header (`X-API-KEY`)
  stay inside the `infra/` class.
- Only the mapped `url`/`title` leave the provider. Do not persist snippets,
  rankings, or raw result payloads (ADR-0005: store what we crawl, not the
  search results).

**Serper specifics:** `POST https://google.serper.dev/search`, key in the
`X-API-KEY` header. Each request is one Billable Call (ticket 08). Check
Serper's current docs for how `num` above 10 is billed before choosing a page
size.

- [ ] `SearchProvider` port + token in `jobs/domain/`, returning vendor-neutral `WebSearchHit`s
- [ ] `SerperSearchProvider` in `jobs/infra/`, reading `SERPER_API_KEY` through a `@nestjs/config` namespace (added to `env.validation.ts`, `.env.example`, Render env)
- [ ] Job params accept a `sources` list; runner queries each selected Source
- [ ] Search form has Google Maps / Web search checkboxes; at least one required
- [ ] Web result → Lead mapping as described; `fonte` = "Busca Web"
- [ ] Domain normalization function; `leads` deduped on normalized domain when `place_id` is absent
- [ ] Web Search Leads are enriched by the existing pipeline and linked as Collected Leads
- [ ] Swapping `SearchProvider` implementations needs no change to Job logic: the runner and use case import only the port
- [ ] Unit tests: domain normalization, result mapping, Serper response → `WebSearchHit` mapping. Integration test: Job with the `SearchProvider` port mocked (not Serper's HTTP), so the test survives a vendor swap
