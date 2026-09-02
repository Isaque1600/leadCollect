# Separate dev and prod environments, each tracking a branch

The deployed system runs as two fully isolated environments:

| | API (Render) | tracks branch | SPA (Vercel) | Database (Neon) |
| --- | --- | --- | --- | --- |
| **dev** | `olc-api-dev` | `dev` | preview deploys | its own dev database |
| **prod** | `olc-api` | `main` | production deploy | its own prod database |

Each environment has its own Render service, its own Neon database, its own
Google OAuth callback, and its own `CORS_ORIGINS` / `WEB_APP_URL` / `JWT_SECRET`.
Nothing is shared between them.

We chose this over a single environment (or Render preview environments off one
service) because `dev` is where migrations, OAuth changes, and Lead Pool schema
work get exercised against real infrastructure before they reach users. A shared
database would let a half-finished migration on `dev` corrupt prod data; a shared
Render service would make every `dev` push a production deploy.

Cost: two of everything to provision and keep in sync (`render.yaml` defines both
services), and a `dev → main` promotion is a deliberate PR, not an auto-deploy.
Acceptable — the promotion gate is a feature, not friction.
