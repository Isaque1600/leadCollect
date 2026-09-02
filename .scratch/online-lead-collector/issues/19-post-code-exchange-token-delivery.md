# 19: Replace the URL-fragment token handoff with a POST code exchange

**What to build:** After a successful Google sign-in the API stops putting the
JWT in the redirect URL. Instead it redirects with a short-lived, single-use
**exchange code**, and the SPA POSTs that code back to the API to receive the
JWT in a response body.

Today `AuthController.callback` does:

```ts
res.redirect(`${webAppUrl}/#token=${encodeURIComponent(token)}`);
```

A URL fragment is not sent to servers and stays out of the Referer header, which
is why it was acceptable for ticket 02 — but the token still lands in the
browser's address bar, in history, and in anything that reads `location`. It was
recorded as a deliberate tradeoff on PR #2 with this as the hardening path.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `SignInWithGoogle` (or a sibling use-case) mints an exchange code alongside the user
- [ ] The callback redirects to the SPA with `?code=…`, not `#token=…`
- [ ] `POST /auth/exchange` takes the code and returns the JWT in the response body
- [ ] Codes are single-use — a second exchange of the same code fails
- [ ] Codes expire quickly (a minute or two is plenty; the SPA redeems immediately)
- [ ] An unknown, expired, or already-used code returns 401 with no detail about which
- [ ] The SPA redeems the code on its callback route and clears it from the URL
- [ ] `packages/types` carries the request/response shape
- [ ] Unit tests: happy path, replay, expiry, unknown code

## Notes

- **Where the codes live is the open decision.** A `auth_exchange_codes` table
  is the obvious answer and needs a migration; an in-memory map is simpler but
  breaks the moment the API runs more than one instance, and Render can restart
  a free instance at any time. ADR-0003 already accepts in-process state for the
  Job runner, so there is a precedent either way — **state which you chose and
  why in the PR, and ask if the ticket's reasoning does not settle it.**
- Store a hash of the code, not the code itself, for the same reason passwords
  are hashed: the table should not be a bag of usable credentials.
- **Sequence with ticket 18.** That ticket creates `/auth/callback` as a real
  route, which is exactly where the redemption belongs. Doing 18 first makes
  this one smaller; doing this one first means 18 has to move the redemption
  logic. Prefer 18 first.
- Out of scope: refresh tokens, token rotation, and moving the JWT out of
  localStorage into a cookie. Those are separate decisions with their own
  tradeoffs — do not fold them in.
