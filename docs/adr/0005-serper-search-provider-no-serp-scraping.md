# Web Search via Serper.dev behind a SearchProvider interface; no SERP scraping of our own; Sheets output dropped

The Web Search Source calls the Serper.dev search API, accessed through a
`SearchProvider` interface so the vendor can be swapped without touching Job
logic.

## Why Serper, not Brave (revised 2026-09-29)

This ADR originally chose Brave Search for its free tier. Research on
2026-09-29 overturned that:

- Brave dropped the free tier in February 2026: $5/month of credit (~1,000
  searches per account), then $5 per 1,000.
- Brave's API terms (§3(b)(i)) forbid "store, cache, or create a database of
  Search Results" outside plans that grant storage rights (Enterprise). That
  conflicts with the Lead Pool (ADR-0002).

Serper.dev is ~$0.30–1.00 per 1,000 searches (~$8/month at 5,000), has 2,500
one-off free searches, supports Brazil targeting (`gl=br`, `hl=pt-br`), and its
terms contain no storage ban — the licence runs "for as long as your use case
requires" and only forbids mirroring the materials as-is with no value added.

Rejected alternatives: Exa (terms forbid copying results), Tavily ("internal
business purposes" licence), SerpAPI (~$75/month for the same volume), Google
Custom Search JSON API (closed to new customers), Bing Web Search API (retired
2025-08-11). Fallbacks if Serper stops fitting: DataForSEO (cheapest at scale,
city-level targeting, async) or Mojeek Business (own index, storage explicitly
permitted; Brazil coverage untested).

## Store what we crawl, not the search results

A web result is used only to discover a business's website. The Lead Pool
persists the normalized domain/URL and a name, then Enrichment fills contacts by
visiting the site. We do not persist snippets, rankings, or raw result
payloads. This keeps us clear of storage clauses with any vendor, and keeps the
swap cheap.

## No SERP scraping of our own

Scraping Google's results page directly was rejected: it breaks on every layout
change, gets the server IP blocked, and violates Google's terms. Paying for a
SERP API is the stable path.

Known risk: Serper (like SerpAPI and DataForSEO) obtains its results by scraping
Google, and Google is litigating against SerpAPI (filed December 2025, refiled
August 2026). The exposure sits mainly with the vendor, but the supply could
disappear or reprice — which is what the `SearchProvider` seam is for.

## Sheets output dropped

The original Google Sheets output mode is dropped. It required a service-account
JSON credential, which does not fit a multi-user app where each user
authenticates with their own Google account for identity only (`openid email
profile`, no Drive/Sheets scopes, so no Google verification review). Output is
xlsx download only.
