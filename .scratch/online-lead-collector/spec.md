# Online Lead Collector

Take the existing lead-collector CLI online as a multi-user web app: Google login,
a search form over two Sources (Google Maps / Brave web search), a shared Lead
Pool that minimizes paid API calls, per-user Quota, an in-process Job runner with
progress polling, and per-Job xlsx export.

See `CONTEXT.md` for the glossary and `docs/adr/0001`–`0006` for the architectural
decisions this breakdown assumes.

## Tickets

| # | Title | Blocked by |
|---|-------|-----------|
| 01 | Walking skeleton | — |
| 02 | Google login | 01 |
| 03 | Maps Source job — backend | 02 |
| 04 | Maps Source job — frontend | 03 |
| 05 | Enrichment + Stale Lead refresh | 03 |
| 06 | Web Search Source (Brave) | 05 |
| 07 | Lead Pool cache-first lookup | 06 |
| 08 | Quota enforcement | 07 |
| 09 | Job concurrency, cancel, reaper | 04 |
| 10 | xlsx export + LGPD notice | 04 |
| 11 | GitHub repo + push (human) | 01 |
| 12 | Deploy the API to Render (human) | 11 |
| 13 | Deploy the SPA to Vercel + wire end to end (human) | 12 |
| 14 | Make CI steps explicit | 01 |
| 15 | Local Docker Compose environment (clean-build audit) | 01 |
| 16 | Run database migrations on deploy | 02 |

Critical path: 01 → 02 → 03 → 05 → 06 → 07 → 08. Tickets 04, 09, 10 form a
parallel frontend track once 03 lands. Tickets 11–13 are human infra setup that
finish ticket 01's deployment; they can run in parallel with 02+.
