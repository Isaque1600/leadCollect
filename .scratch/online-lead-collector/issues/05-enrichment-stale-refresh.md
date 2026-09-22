# 05: Enrichment + Stale Lead refresh

**What to build:** During a Job, every newly collected Lead that has a website is
enriched — the site is fetched (respecting its `robots.txt` and a delay between
requests) and email, WhatsApp, and phone are extracted by pattern matching, as
`collector_maps.py` does today. Each Lead records `enriched_at`. When a Job's
search touches a Lead whose `enriched_at` is more than 30 days old (a Stale
Lead), that Lead is re-enriched in the background without blocking the Job.

**Blocked by:** 03

**Status:** done (branch `feature/05-enrichment-stale-refresh`)

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
- Phone precedence stays honest because Enrichment runs immediately after the
  Maps upsert, which has just refreshed `phone` from Places: the "Places phone"
  in the precedence really is the Places phone, not a leftover from an earlier
  Enrichment.
- Out of scope, deliberately: nothing about Enrichment is exposed over HTTP, so
  `packages/types` is untouched; the Web Search Source (ticket 06) will call the
  same `ENRICHMENT` port.
- Verified with `pnpm lint`, `pnpm typecheck`, `pnpm test` (123 unit tests) and
  `pnpm build`, plus `pnpm --filter @olc/api test:integration` against a
  throwaway `postgres:16` container (6 tests, including the new "enriches a new
  Lead from its website" and "re-enriches a Stale Lead in the background").
