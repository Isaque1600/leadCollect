# 02: Google login

**What to build:** A user can sign in with their Google account and the app knows
who they are. Neon Postgres is connected via Drizzle with `drizzle-kit`
migrations. A `users` table stores `google_id`, `email`, `name`, and
`monthly_quota_used`. The API runs Google OAuth (`openid email profile` only) and,
on success, issues a JWT. The SPA has a "Sign in with Google" button; after the
round trip it stores the JWT in localStorage, sends it as `Authorization: Bearer`
on API calls, and shows the signed-in user's email with a logout button.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Drizzle + `postgres.js` connected to Neon's pooled URL; `drizzle-kit` migrations run against the direct URL
- [ ] `users` table created via migration
- [ ] Google OAuth flow in the API requesting only `openid email profile`, no offline access
- [ ] First login creates a `users` row; subsequent logins match on `google_id`
- [ ] API issues a signed JWT; a `GET /me` endpoint returns the current user from the bearer token
- [ ] SPA: sign-in button, token persisted to localStorage, attached to requests, email shown, logout clears it
- [ ] Requests with a missing or invalid token are rejected with 401
