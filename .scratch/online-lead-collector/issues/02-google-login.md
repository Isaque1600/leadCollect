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

- **Layout** (ADR-0008): the API is a modular monolith. `src/modules/identity/`
  owns sign-in (`domain/` user + `Users` port, `application/`
  `SignInWithGoogleUseCase` + `TokensService`, `api/` controller + strategy +
  guard + `@CurrentUser()`, `infra/` `identity.schema.ts` +
  `DrizzleUsersRepository`). `src/modules/health/` is its own module.
  `src/shared/` holds only what more than one module needs: `config/` and `db/`.
  `src/schema.ts` is the composition root's merge of every module's schema.
- **DB wiring** (ADR-0006): `apps/api/src/shared/db/db.module.ts` builds the
  Drizzle handle from `DATABASE_URL` (Neon **pooled**, `prepare: false`) behind
  a global `DB` provider, and drains the pool in `onApplicationShutdown`.
  `drizzle.config.ts` finds schemas by glob (`./src/modules/**/*.schema.ts`) and
  it and `src/shared/db/migrate.ts` use `DATABASE_URL_DIRECT` (Neon **direct**).
  `postgres()` connects lazily, so `build`/`test` need no live database.
- **Config** (ADR-0008): `src/shared/config/` is the only place that reads
  `process.env`. `@nestjs/config` loads `.env.<NODE_ENV>.local` then `.env`, and
  `registerAs` + `ConfigType` give typed `app`/`database`/`google`/`jwt`
  namespaces — no `configService.get("SOME_KEY")` anywhere. `validateEnv` runs
  at boot and refuses to start on a missing or blank required variable;
  `JWT_SECRET` must additionally be at least 16 characters.
- **Health** (ADR-0008): `@nestjs/terminus`'s `HealthCheckService` with an empty
  indicator list — liveness only, no database indicator, so a Neon blip cannot
  fail a Render deploy. The response keeps a top-level `status: "ok"`, so the
  SPA's `HealthResponse` is unchanged.
- **Migration**: generated at `apps/api/drizzle/0000_users.sql` via
  `pnpm --filter @olc/api db:generate`. Applied with
  `pnpm --filter @olc/api db:migrate` (runs `src/shared/db/migrate.ts` through
  `tsx`, loading `.env.${NODE_ENV:-development}.local` via node's
  `--env-file-if-exists`).
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
- **Tests** (ADR-0008): specs live in `test/unit/<module>/<layer>/`, split from
  `test/integration/` by `vitest.unit.config.ts` /
  `vitest.integration.config.ts` (`pnpm test` / `pnpm test:integration`). The
  old thenable Drizzle mock is gone — the `Users` port has an in-memory
  `FakeUsers`. Covered: the sign-in use case (create, match on `google_id`,
  profile refresh), `TokensService` (round trip, foreign secret, expiry),
  `JwtAuthGuard` (401 cases), `GoogleStrategy.validate` (including the no-email
  branch), `AuthController` (callback redirect + `GET /me`), and `validateEnv`.
  No test opens a Postgres connection. The old health spec was deleted — it
  asserted a hand-written literal that Terminus now produces.

### Required user setup (no credentials available to the agent)

1. **Neon**: create the project, copy both connection strings, and set
   `DATABASE_URL` (the `-pooler` host) and `DATABASE_URL_DIRECT` (the plain
   host) in `apps/api/.env` locally and in Render env vars.
2. **Migrate**: `pnpm --filter @olc/api db:migrate` to create the `users` table.
2b. Local env: copy `apps/api/.env.example` to
   `apps/api/.env.development.local` (gitignored). The API now refuses to boot
   with a missing or blank required variable instead of failing later.
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
- Hardening token delivery: the callback still hands the JWT to the SPA in a URL
  fragment. Swapping that for a POST code exchange is a documented tradeoff on
  PR #2 and belongs in its own ticket.
- Integration tests: `test/integration/` and its config exist but are empty
  until ticket 15 provides a local Postgres.
