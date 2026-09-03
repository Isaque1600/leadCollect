# 21: Decide the SPA's route map

**What to decide:** The full set of routes the SPA will have once the remaining
feature tickets land, so screens aren't built at URLs that later move. This is a
decision ticket — no code — but it unblocks 20 and shapes 08, 09 and 10.

**Blocked by:** None (needs a human decision, not prior work)

**Status:** ready-for-human

## Why now

Ticket 04 added `/jobs/:jobId` next to the existing `/`, and immediately
exposed the gap this ticket exists to close: a Job id is only reachable by
starting one or keeping the URL, because nothing lists a user's Jobs. Ticket 20
fixes that, but *where* the list lives is a route-map question, not a ticket-20
question — and the same is true of export (10), cancel (09) and Quota (08).
Deciding once, now, is cheaper than moving screens later.

## Routes today

| Route | Screen | Access |
| --- | --- | --- |
| `/login` | `LoginPage` | public |
| `/auth/callback` | `AuthCallbackPage` | public |
| `/` | `HomePage` — the search form | `RequireAuth` |
| `/jobs/:jobId` | `JobProgressPage` | `RequireAuth` |
| `*` | `NotFoundPage` | — |

## The questions to answer

1. **What is `/`?** The search form (today), the Jobs list, or a redirect to one
   of them? A "start a search" landing page and a "what have I run" dashboard
   are both plausible homes.
2. **Where does the search form live** if `/` becomes the list — `/jobs/new`, a
   panel on the list screen, or a modal?
3. **Where does the Jobs list live** — `/jobs`, or `/` per Q1?
4. **Does `/jobs/:jobId` cover both a running Job and a finished one**, or does
   a finished Job get its own results view? Ticket 10 puts a Collected Leads
   table and an export button somewhere; this decides where.
5. **Is there an account/settings route?** Ticket 08 (Quota) needs somewhere to
   show a user's monthly Billable Call allowance and what's left. A header badge
   on the shell is the alternative to a route.
6. **Does anything need a nested layout** beyond the existing `App` shell?

## What "done" looks like

- The answers recorded under a `## Decision` heading in this file
- `ARCHITECTURE.md`'s route table updated to show the agreed target, marking
  which routes exist and which are planned
- Ticket 20 unblocked, and 09/10's ticket bodies adjusted if the decision moves
  anything they assumed

## Notes

- Ticket 18 established the routing shape: `RequireAuth` wraps a block of
  protected routes in `routes.tsx`, with `App` as the shell inside it. Any new
  protected route is a `<Route>` nested in that block — the decision here is
  about URLs and screen boundaries, not routing mechanics.
- There is no `GET /jobs` endpoint yet (that's ticket 20), so any answer that
  puts a list at `/` also makes 20 a prerequisite for the home screen rendering
  at all.
