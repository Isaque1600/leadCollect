# 05: Enrichment + Stale Lead refresh

**What to build:** During a Job, every newly collected Lead that has a website is
enriched — the site is fetched (respecting its `robots.txt` and a delay between
requests) and email, WhatsApp, and phone are extracted by pattern matching, as
`collector_maps.py` does today. Each Lead records `enriched_at`. When a Job's
search touches a Lead whose `enriched_at` is more than 30 days old (a Stale
Lead), that Lead is re-enriched in the background without blocking the Job.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] robots.txt check, inter-request delay, and the email/WhatsApp/phone regexes ported from the Python script
- [ ] Phone precedence preserved: site WhatsApp → national phone from Places → phone found on site
- [ ] New Leads with a website are enriched during the Job; `possui_site` and `enriched_at` set
- [ ] Leads without a website skip enrichment cleanly
- [ ] A Job that reuses a Lead with `enriched_at` older than 30 days queues a background re-enrichment
- [ ] Re-enrichment updates the Lead Pool record in place; it does not block the Job from finishing
- [ ] Unit tests: each regex, the stale-age boundary. Integration test: Job enriches a mocked site
