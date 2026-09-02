# 18: SPA routing, protected routes, and the app shell

**What to build:** The SPA gets real routes instead of one conditional
component. Signed-out users land on a login page; signed-in users get an app
shell (header with the signed-in email and a logout button) wrapping the
feature screens. The OAuth round trip finishes on its own callback route rather
than by scraping the URL fragment in `App.tsx`.

Today `apps/web/src/App.tsx` renders either a "Sign in with Google" link or a
signed-in line, and `apps/web/package.json` has no router at all — that was the
whole of ticket 02's scope, not a decision about the interface. This ticket
makes the decision, because ticket 04 needs somewhere to navigate *to* and every
later UI ticket inherits whatever shape lands here.

**Blocked by:** 02

**Blocks:** 04

**Status:** done (branch `feature/18-spa-routing`)

- [x] A router is installed and wired (`react-router` unless the notes below are overruled)
- [x] Routes: `/login`, `/` (the signed-in home), `/auth/callback`, and a catch-all 404
- [x] `/auth/callback` captures the token, stores it, and redirects to the route the user originally wanted (or `/`)
- [x] Token capture moves out of `App.tsx` into that route; `App.tsx` becomes the shell
- [x] A route guard redirects unauthenticated users to `/login`, preserving the intended destination
- [x] Signing out clears the token and returns to `/login`
- [x] An app shell wraps the protected routes: the signed-in email and a logout button live there, not in each screen
- [x] `/login` renders only the sign-in call to action — no API status line, no shell chrome
- [x] A 401 from any API call clears the token and bounces to `/login` (one place, not per call site)
- [x] Deep-linking works: opening a protected URL while signed out lands you back on it after sign-in
- [x] Existing tests updated; the `api-status`, `google-login` and `user-email` test ids keep working or their assertions move with them

## Notes

- **Why now, and why it blocks 04:** ticket 04 says "navigates to the progress
  view for that job id" and polls `GET /jobs/:id` every ~2s. A job that runs for
  minutes *will* get refreshed, so the progress view wants to be a real
  addressable route (`/jobs/:id`), not component state. Build 04 on top of this,
  not beside it.
- **Router choice:** `react-router` is the default recommendation — smallest
  step from where the SPA is, and the guard/redirect pattern is well trodden.
  TanStack Router is the alternative worth a moment's thought, since ticket 04
  already commits to TanStack Query and its typed routes and built-in
  `beforeLoad` guards pair well. This is a convention for every later UI ticket,
  so **if you would pick differently from the recommendation, ask rather than
  switching quietly.**
- **Not a styling ticket.** Structure only — routes, the guard, the shell. No
  design system, no CSS framework. If the app needs one later that is its own
  ticket and its own decision.
- **Related but deliberately separate:** the API currently hands the SPA its
  token in a URL fragment (`auth.controller.ts`, redirect to
  `${WEB_APP_URL}/#token=…`). Hardening that into a POST code exchange is an API
  change and has its own ticket. Do them in either order — but note this ticket
  creates `/auth/callback`, which is exactly where that exchange will land, so
  doing this one first makes the other smaller.
- **Watch the trailing slash.** `WEB_APP_URL` is currently set with a trailing
  slash on both Render services and `app.config.ts` does not normalise it, so
  the callback redirect builds `https://host//#token=…`. Whoever touches the
  callback path should confirm the redirect target is what they think it is.

## Notes from the build (branch `feature/18-spa-routing`)

- **Router: `react-router` 7.18.3**, declarative mode (`<BrowserRouter>` +
  `<Routes>`), as recommended. Version 8 is the current latest but its peer range
  is `react >=19.2.7` and this repo pins React 19.0.0; bumping React is not this
  ticket's business, so v7 it is. The API is the same, so moving to v8 later is a
  version bump plus a React bump, nothing more.
- **Structure:** `src/routes.tsx` holds the route table, `src/App.tsx` is the
  shell (`<Outlet/>` + signed-in email + log out), `src/pages/*` are the screens,
  `src/auth/*` is the provider, the guard, and the remembered destination.
- **One place for 401s:** every call goes through `apiFetch` in `src/api.ts`,
  which drops the token and calls the handler registered via `onUnauthorized`.
  `AuthProvider` registers the only handler and just flips to anonymous —
  `RequireAuth` does the navigating. Log out works the same way, so there is one
  route out of the signed-in state, not three.
- **Intended destination lives in `sessionStorage`** (`olc.intendedRoute`), not
  router state: sign-in leaves the SPA entirely, so in-memory state would not
  survive the round trip.
- **Compat shim for the fragment handoff:** the API still redirects to
  `${WEB_APP_URL}/#token=…`, which lands on `/`, not `/auth/callback`.
  `src/auth/legacy-token-fragment.ts` rewrites that to `/auth/callback#token=…`
  before the router mounts, so the deployed flow keeps working and
  `/auth/callback` stays the only place that reads a token from the URL. Ticket
  19 can delete the file once the API redirects to the callback route directly.
- **Trailing slash:** confirmed the double slash (`https://host//#token=…`) is
  harmless here — the shim rewrites the pathname regardless. Normalising
  `WEB_APP_URL` is still worth doing on the API side (ticket 19 touches that
  redirect).
- **No styling**, as instructed: the shell has no CSS at all, and the inline
  styles that used to be on `App.tsx` were dropped rather than moved.
- **Left for ticket 04:** `/jobs/:id` and the search form. The guard's tests use a
  stand-in `/jobs/:jobId` route to prove deep-linking, so wiring the real one is
  a one-line addition to `src/routes.tsx`.
