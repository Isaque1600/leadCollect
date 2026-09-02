# Lead Collector

A multi-user web app that finds business leads from Google Maps and web search,
enriches them with contact details scraped from company websites, and lets each
user export the leads they collected as an Excel file.

## Language

**Lead**:
A business or establishment record with contact information (name, phone/WhatsApp,
email, website, business type). The unit of value the product produces.
_Avoid_: Contact, prospect, company, empresa

**Lead Pool**:
The single global, deduplicated store of every Lead ever found, shared across all
users. A search consults the pool before spending any Billable Call.
_Avoid_: Cache, leads table, dataset

**Collected Lead**:
The link between a user and a Lead in the pool, recording that this user pulled
this Lead into their list (and when). A user's list and their Excel export show
only their Collected Leads, never the whole pool.
_Avoid_: User lead, saved lead, owned lead

**Lead Identity**:
The value that decides whether two found records are the same Lead: the Google
`place_id` for the Maps Source, or the normalized website domain for the Web
Search Source.
_Avoid_: Dedup key, hash, fingerprint

**Job**:
One execution of a search: a set of composed queries run against one or more
Sources, producing Collected Leads for the user who started it. Has a status and
progress, runs asynchronously, and can be cancelled. A user may have only one
running Job at a time.
_Avoid_: Run, task, scrape, batch, collection

**Source**:
An origin that a Job queries for Leads. There are two: the **Maps Source**
(Google Places API) and the **Web Search Source** (Brave Search API). The
Portuguese labels `Google Maps` and `Busca Web` are kept as the `fonte` value in
exports.
_Avoid_: Provider (reserved for the code interface), channel, origin

**Enrichment**:
Visiting a Lead's website to extract email, WhatsApp, and phone via pattern
matching, respecting the site's `robots.txt` and a delay between requests.
_Avoid_: Scraping, crawling, hydration

**Stale Lead**:
A Lead whose Enrichment is more than 30 days old. When a search touches a Stale
Lead, it is re-enriched in the background.
_Avoid_: Expired lead, old lead

**Quota**:
A user's monthly allowance of Billable Calls. When exhausted, the user's searches
still run but return Lead Pool results only, making no further Billable Calls
until the allowance resets on the 1st.
_Avoid_: Limit, credits, budget

**Billable Call**:
A single request that costs money: one Google Places details request, or one
Brave search request. Lead Pool hits are not Billable Calls.
_Avoid_: API call, request, hit
