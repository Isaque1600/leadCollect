# 08: Quota enforcement

**What to build:** Each user has a monthly allowance of Billable Calls (a Google
Places details request or a Brave search request; Lead Pool hits are free). The
default is 500 per user per month, tracked on `users.monthly_quota_used` and reset
on the 1st. While a user has allowance, Jobs run normally. Once it is exhausted,
their Jobs still run but make no further Billable Calls — they return Lead Pool
results only — and the UI shows a banner explaining the limit.

**Blocked by:** 07

**Status:** ready-for-agent

- [ ] Every Billable Call increments `monthly_quota_used` for the Job's user
- [ ] A reset (scheduled or checked-on-use) zeroes the counter at the start of each month
- [ ] When the counter reaches the limit mid-Job, remaining work switches to Pool-only
- [ ] `GET /me` (or similar) exposes `quotaUsed` / `quotaLimit`
- [ ] SPA shows a banner when the user is at or near the limit; the search form still works in Pool-only mode
- [ ] Default limit 500 is configurable per user in the database
- [ ] Unit tests: counting, month boundary, at-limit switch to Pool-only
