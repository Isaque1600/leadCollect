# 06: Web Search Source (Brave)

**What to build:** A Job can also search the Web Search Source. A `SearchProvider`
interface abstracts the search API, with a Brave Search implementation behind it.
The search form gains source checkboxes (Google Maps, Web search); the user can
pick either or both. Web results become Leads: name from the result title, site
from the URL, `fonte` = "Busca Web", `link_origem` = the result URL, no
`place_id`. Their Lead Identity is the normalized website domain, deduped against
the Lead Pool. Web Search Leads flow through the same Enrichment pipeline.

**Blocked by:** 05

**Status:** ready-for-agent

- [ ] `SearchProvider` interface; `BraveSearchProvider` implementation reading an API key from env
- [ ] Job params accept a `sources` list; runner queries each selected Source
- [ ] Search form has Google Maps / Web search checkboxes; at least one required
- [ ] Web result → Lead mapping as described; `fonte` = "Busca Web"
- [ ] Domain normalization function; `leads` deduped on normalized domain when `place_id` is absent
- [ ] Web Search Leads are enriched by the existing pipeline and linked as Collected Leads
- [ ] Swapping `SearchProvider` implementations needs no change to Job logic
- [ ] Unit tests: domain normalization, result mapping. Integration test: Job with Brave mocked
