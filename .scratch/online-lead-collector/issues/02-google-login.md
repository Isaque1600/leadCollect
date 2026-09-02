# 02: Google login

**What to build:** A user can sign in with their Google account and the app knows
who they are. Neon Postgres is connected via Drizzle with `drizzle-kit`
migrations. A `users` table stores `google_id`, `email`, `name`, and
`monthly_quota_used`. The API runs Google OAuth (`openid email profile` only) and,
on success, issues a JWT. The SPA has a "Sign in with Google" button; after the
round trip it stores the JWT in localStorage, sends it as `Authorization: Bearer`
on API calls, and shows the signed-in user's email with a logout button.

**Blocked by:** 01

**Status:** done (branch feature/02-google-login)

- [x] Drizzle + `postgres.js` connected to Neon's pooled URL; `drizzle-kit` migrations run against the direct URL
- [x] `users` table created via migration
- [x] Google OAuth flow in the API requesting only `openid email profile`, no offline access
- [x] First login creates a `users` row; subsequent logins match on `google_id`
- [x] API issues a signed JWT; a `GET /me` endpoint returns the current user from the bearer token
- [x] SPA: sign-in button, token persisted to localStorage, attached to requests, email shown, logout clears it
- [x] Requests with a missing or invalid token are rejected with 401

## Notes

### Decisions

- **DB wiring** (ADR-0006): `apps/api/src/db/db.module.ts` builds the Drizzle
  handle from `DATABASE_URL` (Neon **pooled**, `prepare: false`) behind a global
  `DB` provider. `drizzle.config.ts` and `src/db/migrate.ts` use
  `DATABASE_URL_DIRECT` (Neon **direct**). `postgres()` connects lazily, so
  `build`/`test` need no live database.
- **Migration**: generated at `apps/api/drizzle/0000_users.sql` via
  `pnpm --filter @olc/api db:generate`. Applied with
  `pnpm --filter @olc/api db:migrate` (runs `src/db/migrate.ts` through `tsx`).
- **OAuth** (ADR-0005): `passport-google-oauth20` with scopes
  `["openid","email","profile"]` only, no `accessType: "offline"` — no refresh
  token, no Drive/Sheets. Config from `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`.
- **Session** (ADR-0001): stateless JWT **bearer**, not cookies. `@nestjs/jwt`
  signs `{ sub, email }` with `JWT_SECRET`, 7-day expiry. `JwtAuthGuard` is a
  plain guard (no passport-jwt) that verifies the token and loads the `users`
  row; missing/malformed/expired/unknown-user → 401.
- **Callback → SPA**: `/auth/google/callback` upserts the user, mints the JWT,
  and 302-redirects to `${WEB_APP_URL}/#token=<jwt>` (fragment keeps the token
  out of logs/Referer). The SPA (`apps/web/src/api.ts` `captureTokenFromUrl`)
  reads the fragment, stores the token under `localStorage["olc.token"]`, strips
  the fragment, then calls `GET /me` with `Authorization: Bearer`. Logout clears
  the key.
- **Shared types**: `MeResponse`, `AuthTokenClaims`, `AuthCallbackParams` added
  to `@olc/types`.
- **Tests**: `auth.service.spec.ts` (DB mocked — insert-on-first-login,
  match-on-google_id, JWT round trip) and `jwt-auth.guard.spec.ts` (401 cases).
  No test opens a Postgres connection.

### Required user setup (no credentials available to the agent)

1. **Neon**: create the project, copy both connection strings, and set
   `DATABASE_URL` (the `-pooler` host) and `DATABASE_URL_DIRECT` (the plain
   host) in `apps/api/.env` locally and in Render env vars.
2. **Migrate**: `pnpm --filter @olc/api db:migrate` to create the `users` table.
3. **Google Cloud Console**: create an OAuth 2.0 Client (type: Web application).
   Authorized redirect URI = `GOOGLE_CALLBACK_URL`
   (`http://localhost:3000/auth/google/callback` for local, the Render URL in
   prod). Consent screen scopes: `openid`, `email`, `profile` only. Put the id
   and secret in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. Set `JWT_SECRET` (long random string) and `WEB_APP_URL` (the SPA origin) in
   the API env. Add the API origin to `CORS_ORIGINS` if not already covered.

### Out of scope (not done, deferred to later tickets)

- Monthly reset of `monthly_quota_used` on the 1st (ticket 08 — quota).
- Any use of the token beyond `/me` (job endpoints arrive in tickets 03+).
- Token refresh / rotation — the 7-day JWT simply expires and the SPA falls back
  to the sign-in button on the next 401.
