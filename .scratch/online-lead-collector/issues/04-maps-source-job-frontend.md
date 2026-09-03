# 04: Maps Source job — frontend

**What to build:** A signed-in user can run a Maps search from the UI. A search
form collects business type, city, state, and max results. Submitting it creates
a Job and switches to a progress view that polls `GET /jobs/:id` (~2s) and shows a
progress bar and the running counts. When the Job finishes, the view shows how
many Leads were collected. Errors surface as a message.

**Blocked by:** 03, 18

**Status:** done (merged into `dev` via PR #7, 2026-09-03)

- [x] Search form with fields: business type, city, state, max results per source
- [x] Submitting calls `POST /jobs` and navigates to `/jobs/:id` (the routing and shell come from ticket 18)
- [x] Progress view polls `GET /jobs/:id` with TanStack Query and stops polling on `done` / `failed` / `cancelled`
- [x] Progress bar derived from `queriesDone / queriesTotal`; counts for leads found and API calls used shown
- [x] Terminal states show a clear summary or the error text
- [x] Shared request/response types come from `packages/types`

## Notes

- **TanStack Query is adopted here** (`@tanstack/react-query` 5.102.8, pinned like
  every other dep), as the ticket names. It is the first data-fetching library in
  the SPA and sets the convention for tickets 07, 09 and 10.
  - `createQueryClient()` lives in `src/query-client.ts`; `main.tsx` mounts one
    `QueryClientProvider` *outside* `BrowserRouter` and `AuthProvider`, so the
    whole app — the provider included — is inside it.
  - **It composes with the existing 401 pattern rather than replacing it.** Every
    query/mutation function still calls `apiFetch`, which is still the one place
    that clears the token and fires `onUnauthorized`; `AuthProvider` still flips
    to anonymous and `RequireAuth` still does the navigating. The only query
    config that touches auth is `retry`, which refuses to retry an
    `UnauthorizedError` (retrying would fire doomed requests at a signed-out
    app). Screens skip rendering an error for `UnauthorizedError` because the
    redirect is already under way.
  - `refetchOnWindowFocus` is off; mutations do not retry.
  - `AuthProvider` now calls `queryClient.clear()` when the user goes anonymous
    (sign-out or a 401), so one user's cached Job data cannot show up for the
    next person to sign in on that tab. This is why `AuthProvider` needs a
    QueryClient above it, and why `RequireAuth.test.tsx` grew a provider wrapper.
- **`ApiError` in `api.ts`**: a non-401, non-2xx response used to throw
  `new Error("/jobs failed: 400")`. It now throws an `ApiError` carrying the
  status and the API's own `message` (Nest sends a string, or an array for a
  failed `ValidationPipe`), so "errors surface as a message" means the API's
  message, not a status code. Falls back to the old text when the body is not
  JSON.
- **No new shared types were needed** — ticket 03 already put `StartJobRequest`,
  `StartJobResponse`, `JobProgressResponse` and `JobStatus` in `packages/types`,
  and the SPA compiles against those. Nothing is redeclared in `apps/web`.
- **Polling** is `refetchInterval` returning `2000` until `isTerminal(status)`,
  then `false` — TanStack Query owns the timer, so there is nothing to clear on
  unmount and a refresh of `/jobs/:id` resumes cleanly. `cancelled` is already
  treated as terminal even though nothing can produce it until ticket 09.
- **Still no styling**, matching ticket 18. The progress bar is a native
  `<progress>`; `max` is clamped to at least 1 so a `queriesTotal` of 0 renders
  an empty bar instead of a broken one.
- The `/health` line stayed on `HomePage` below the new search form: it is what
  `App.test.tsx`'s "a 401 from any call bounces to /login" test drives, and
  removing it is not this ticket's business.
- **Out of scope, left as-is:** no cancel button (ticket 09), no export or list
  of Collected Leads (ticket 10), and no list of the user's past Jobs — there is
  no `GET /jobs` endpoint, so a Job id is only reachable by starting one or by
  keeping the URL.
