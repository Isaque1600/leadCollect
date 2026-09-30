# 05: Enrichment + Stale Lead refresh

**What to build:** During a Job, every newly collected Lead that has a website is
enriched — the site is fetched (respecting its `robots.txt` and a delay between
requests) and email, WhatsApp, and phone are extracted by pattern matching, as
`collector_maps.py` does today. Each Lead records `enriched_at`. When a Job's
search touches a Lead whose `enriched_at` is more than 30 days old (a Stale
Lead), that Lead is re-enriched in the background without blocking the Job.

**Blocked by:** 03

**Status:** done (merged into `dev` via PR #8, 2026-09-30; owner decisions and follow-ups listed in `HANDOFF.md`)

- [x] robots.txt check, inter-request delay, and the email/WhatsApp/phone regexes ported from the Python script
- [x] Phone precedence preserved: site WhatsApp → national phone from Places → phone found on site
- [x] New Leads with a website are enriched during the Job; `possui_site` and `enriched_at` set
- [x] Leads without a website skip enrichment cleanly
- [x] A Job that reuses a Lead with `enriched_at` older than 30 days queues a background re-enrichment
- [x] Re-enrichment updates the Lead Pool record in place; it does not block the Job from finishing
- [x] Unit tests: each regex, the stale-age boundary. Integration test: Job enriches a mocked site

## Notes

- New module `apps/api/src/modules/enrichment/` (ADR-0008), depending on
  `leads` for the `LEAD_POOL` port: `jobs → enrichment → leads`. It is the only
  place in the API that makes outbound requests to sites we do not own, and
  ticket 06's Web Search Source will need it too, so it is not a corner of
  `jobs` or of `leads`.
- Migration `0002_enrichment.sql` adds `leads.enriched_at` (nullable
  timestamptz). Null = never enriched; more than 30 days old = a Stale Lead.
- **Two decisions worth a veto:**
  1. *robots.txt is hand-rolled*, not `robots-parser` or any other dependency.
     `domain/robots-txt.ts` is a ~90-line port of the semantics of Python's
     `urllib.robotparser.RobotFileParser` — the exact thing ADR-0004 says to
     port — group by `User-agent`, first matching prefix rule wins, fail open on
     anything unexpected. Wildcards (`*`, `$`) inside paths are ignored, as
     CPython ignores them. The alternative is `robots-parser`, which is more
     correct against the modern spec but sets a "add a dependency" convention
     and changes behaviour relative to the script we are porting.
  2. *Background re-Enrichment is a floating promise*, not a scheduler. Nest
     ships `@nestjs/schedule`, but it schedules *recurring* work (cron,
     intervals) and would not help here; `@nestjs/bullmq` is what ADR-0003
     explicitly rejected. `StartMapsJobUseCase` already establishes exactly this
     pattern for the Job itself, and `EnrichmentService.refresh` cannot reject,
     so the floating promise cannot take the process down. The trade-off is the
     ADR-0003 one: a Render restart mid-refresh loses that refresh, and the Lead
     is simply picked up again as stale by the next Job that touches it.
- Enrichment owns `email`, `phone` and `enriched_at`. A found value overwrites,
  a null does not — one unreachable visit cannot erase an email collected
  months ago. `enriched_at` is stamped even when the visit yielded nothing, so
  a dead site is not re-visited by every Job for the next 30 days.
- Phone precedence: see "Review fixes" below — the Places phone is now passed
  to Enrichment explicitly rather than read back from the stored `phone`.
- Out of scope, deliberately: nothing about Enrichment is exposed over HTTP, so
  `packages/types` is untouched; the Web Search Source (ticket 06) will call the
  same `ENRICHMENT` port.
- Verified with `pnpm lint`, `pnpm typecheck`, `pnpm test` (123 unit tests) and
  `pnpm build`, plus `pnpm --filter @olc/api test:integration` against a
  throwaway `postgres:16` container (6 tests, including the new "enriches a new
  Lead from its website" and "re-enriches a Stale Lead in the background").

## Review fixes (PR #8 review)

- **Phone precedence on re-Enrichment (blocking).** Since the second commit the
  upsert keeps the stored `phone` once a Lead is enriched, so the stored value
  is Enrichment's last pick, not Places'. Passing it to `pickPhone` as the
  "Places phone" let an old WhatsApp stick forever. Fix: `EnrichmentTarget`
  gained `placesPhone`, and `JobRunner` hands over `{ ...lead, placesPhone:
  details.phone }` — the value Places returned in *this* Job.
  `EnrichmentService` computes `pickPhone(contacts, placesPhone) ?? phone`.
  - Chosen over a `places_phone` column because the Places phone is already in
    hand at the one call site; a column would mean a schema change, a second
    phone to keep in sync, and nothing reads it but this one call.
  - The `?? phone` fallback applies the rule the email already follows ("a found
    value overwrites, a null does not"): if neither the site nor Places has a
    phone, the stored one is kept rather than erased. Worth a veto if the owner
    would rather a phone disappear when every source has dropped it.
  - Ticket 06's Web Search Source has no Places phone and will pass `null`.
  - Integration test "re-applies the phone precedence with the fresh Places
    phone when a Stale Lead is re-enriched" is the reviewer's exact case
    (stored `5583999990000`, enriched 31 days ago, Places `(83) 3421-0000`,
    site without WhatsApp → Places phone). It fails on the old code.
  - No schema change, so `0002_enrichment` is untouched.
- **SSRF fence in `HttpWebsiteFetcher`.** Ticket 06 will feed it arbitrary web
  search URLs. It now uses `node:http`/`node:https` instead of `fetch`: Node's
  `fetch` only accepts a custom DNS `lookup` through an `undici` `Agent`, which
  would be a new dependency, while `node:http` takes `lookup` directly.
  - `http:`/`https:` only (`data:`, `file:`, `ftp:`... return null, no request).
  - `infra/public-address.ts`: `isPublicAddress` (a `net.BlockList` of
    loopback, private, link-local/metadata, CGNAT, unspecified, multicast,
    reserved, documentation, NAT64, IPv6 ULA/link-local/site-local; IPv4-mapped
    forms are matched against the IPv4 ranges by `BlockList` itself) and
    `guardedLookup`, which wraps `dns.lookup` and fails if *any* resolved
    address is non-public. Because the check sits in the socket's own `lookup`,
    the checked address is the connected address — no rebinding window.
    IP-literal hosts skip `lookup`, so they are checked before connecting.
  - `agent: false`: a fresh connection per request, so a pooled socket can never
    bypass `lookup`.
  - Redirects are followed by hand (`maxRedirects: 5`), each hop re-running the
    scheme and address checks; one 10 s timeout covers the whole visit.
  - `sanitizeWebsiteUrl` (`leads/domain/lead.ts`) is deliberately unchanged: it
    still stores a non-http `websiteUri` as-is (ticket 03's choice). The fence is
    where the request is made, which also covers URLs that never pass through
    the Lead Pool.
- **Body cap.** 2 MB (`maxBodyBytes`), counted on decoded bytes while
  streaming; the connection is destroyed the moment the count passes the cap
  (and up front on an oversized `Content-Length`). An oversized page reads as
  unreadable (`null`), not truncated. `gzip`/`deflate`/`br` are decoded with
  `node:zlib`, as `fetch` did implicitly.
- **`robots.txt` status.** `robotsRulesFor` (domain): 401/403 → disallow all,
  other 4xx → allow all, 2xx → parse, as CPython's `RobotFileParser.read`.
  A 5xx is still *allowed* here, which diverges from CPython (it never parses,
  so `can_fetch` returns False) — left as it was, raised as a question.
- Tests: the fetcher spec now runs against an in-process `node:http` server on
  loopback (reached through a fake `lookup` and a test-only address policy),
  covering scheme refusal, IP-literal / `localhost` / resolved-private refusal,
  redirect re-checks and the limit, the size cap (Content-Length, an endless
  stream, a gzip bomb), gzip decoding, and 401/403 vs 404/410/429 robots.txt.
  `public-address.spec.ts` covers the address table and `guardedLookup`. The
  integration test now scripts the web with a `WebsiteFetcher` stand-in, since
  stubbing `fetch` no longer reaches the fetcher.
- Not changed, noted only: inline Enrichment is awaited per new Lead, worst case
  about 21 s (two 10 s timeouts plus two 500 ms delays) — relevant to ticket 09's
  15-minute stuck-Job reaper.
- Still open for the owner: hand-rolled `robots.txt` parser vs the
  `robots-parser` package; whether a 5xx `robots.txt` should disallow as CPython
  does.
