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

**Status:** ready-for-agent

- [ ] A router is installed and wired (`react-router` unless the notes below are overruled)
- [ ] Routes: `/login`, `/` (the signed-in home), `/auth/callback`, and a catch-all 404
- [ ] `/auth/callback` captures the token, stores it, and redirects to the route the user originally wanted (or `/`)
- [ ] Token capture moves out of `App.tsx` into that route; `App.tsx` becomes the shell
- [ ] A route guard redirects unauthenticated users to `/login`, preserving the intended destination
- [ ] Signing out clears the token and returns to `/login`
- [ ] An app shell wraps the protected routes: the signed-in email and a logout button live there, not in each screen
- [ ] `/login` renders only the sign-in call to action — no API status line, no shell chrome
- [ ] A 401 from any API call clears the token and bounces to `/login` (one place, not per call site)
- [ ] Deep-linking works: opening a protected URL while signed out lands you back on it after sign-in
- [ ] Existing tests updated; the `api-status`, `google-login` and `user-email` test ids keep working or their assertions move with them

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
