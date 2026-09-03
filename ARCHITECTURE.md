# Architecture

Where things live and how a request moves through the system — read this to
orient before reviewing a PR. For vocabulary (User, Lead, Job, ...) see
`CONTEXT.md`; for *why* a decision was made, see `docs/adr/`. This file
describes *what exists now* and gets updated as tickets land — it is not a
target design, and it is not the place to record a decision's rationale
(that's an ADR).

## apps/api

NestJS. ADR-0008: a modular monolith — one folder per module under
`src/modules/`, each with `domain/ application/ api/ infra/` inside,
`shared/` for what more than one module needs. Read
`docs/adr/0008-api-modular-monolith.md` before adding files here.

```
src/
├─ modules/
│  ├─ identity/   Google OAuth sign-in, JWT issuing, the users table
│  ├─ jobs/       Job entity + runner, the Maps Source, /jobs endpoints
│  ├─ leads/      the Lead Pool, Collected Leads, the LEAD_POOL port
│  └─ health/     GET /health (@nestjs/terminus)
├─ shared/
│  ├─ config/     typed env namespaces, validated at boot (env.validation.ts)
│  └─ db/         the Drizzle client, migrator, connection lifecycle
└─ main.ts        global ValidationPipe, CORS, shutdown hooks
```

Inside each module, the dependency only points one way:
`jobs → leads → (nothing)`, `identity → (nothing)`. A module's `domain/`
declares ports (interfaces); its own `infra/` implements them with Drizzle.
Nothing outside a module reaches into another module's `infra/` or `domain/`
internals directly — only through the port, injected via `@Module`.

### Routes today

| Method | Path | Guard | Module |
| --- | --- | --- | --- |
| `GET` | `/health` | — | health |
| `GET` | `/auth/google` | — (starts OAuth) | identity |
| `GET` | `/auth/google/callback` | — (OAuth redirect target) | identity |
| `GET` | `/me` | `JwtAuthGuard` | identity |
| `POST` | `/jobs` | `JwtAuthGuard` | jobs |
| `GET` | `/jobs/:id` | `JwtAuthGuard` | jobs |

### Request flow (an authenticated call, e.g. `POST /jobs`)

```
SPA (apiFetch, Bearer token)
  → ValidationPipe (class-validator on the DTO)
  → JwtAuthGuard (identity module)
  → Controller
  → Use-case (application/)
  → Port (domain/, an interface)
  → Drizzle adapter (infra/)
  → Postgres (Neon in deploy, the `db` compose container locally)
```

`JobRunner` (jobs/application) is the one exception to "request in, response
out": `POST /jobs` returns immediately with a `queued` Job, and the runner
keeps going in-process (ADR-0003 — no queue) until the Job row reaches
`done`/`failed`. The SPA polls `GET /jobs/:id` for progress.

### Auth

Google OAuth via `@nestjs/passport`'s `google` strategy → `identity` issues
its own JWT → the SPA carries it as `Authorization: Bearer` on every call
after. `GET /auth/google/callback` redirects back to the SPA with the token
in a URL fragment (`#token=...`), which `apps/web/src/api.ts`'s
`captureTokenFromUrl` reads once and strips.

## apps/web

React 19 + React Router 7 + Vite. No state library beyond React context —
`AuthProvider` is the only cross-cutting one so far.

```
src/
├─ api.ts              every API call goes through here — one place that
│                       knows the base URL, attaches the Bearer token, and
│                       reacts to a 401 (see below)
├─ auth/
│  ├─ AuthProvider.tsx  who's signed in; exposes { status, user, signOut }
│  ├─ RequireAuth.tsx   route guard — anonymous visitors bounce to /login
│  ├─ intended-route.ts remembers where an anonymous visit was headed
│  └─ legacy-token-fragment.ts  parses the OAuth callback's #token=...
├─ pages/               one file per route-level screen
│  ├─ LoginPage.tsx
│  ├─ AuthCallbackPage.tsx
│  ├─ HomePage.tsx      the only protected screen today
│  └─ NotFoundPage.tsx
├─ App.tsx              the shell around every protected route (header,
│                       "Signed in as ...", sign-out) — Outlet renders the
│                       matched page inside it
└─ routes.tsx            the route table (see below)
```

### Route table

```
/login            LoginPage           — public
/auth/callback     AuthCallbackPage    — public, captures the JWT then redirects
/                  App > HomePage      — behind RequireAuth
*                  NotFoundPage
```

`RequireAuth` wraps everything under it in one `<Route element={<RequireAuth />}>`
— a new protected page is a new `<Route path="..." element={<Page />} />`
nested inside that block in `routes.tsx`, next to `HomePage`.

### The 401 pattern

There is exactly one place that reacts to an expired/invalid token:
`api.ts`'s `apiFetch` clears the stored token and calls a registered
`onUnauthorized` handler on any `401`, from *any* call, anywhere in the app.
`AuthProvider` is the only subscriber — it flips `status` to `"anonymous"`,
which makes `RequireAuth` redirect. A new page never has to handle 401 itself;
just call `apiFetch` (or a wrapper around it) and let the app fall through.

### What's not built yet in the SPA

No page starts a Job, shows its progress, or downloads an export — `HomePage`
is a placeholder. That's tickets 04 (start a Job + progress), 09
(cancel/concurrency UI), and 10 (export + LGPD notice), all `ready-for-agent`.
See `.scratch/online-lead-collector/issues/`.

## Cross-cutting

- **Deploy topology**: ADR-0007. Two fully separate environments (`dev`
  branch → `leadCollect-Dev` + a preview Vercel deploy; `main` → 
  `leadCollect-Prod` + the production Vercel deploy), each its own Neon
  database. `render.yaml` defines both Render services.
- **CI**: `.github/workflows/ci.yml` — lint/typecheck/test/build on every PR
  and on push to `dev`/`main`; `deploy-web` triggers the Vercel deploy hook
  for the pushed branch (the API deploys separately, via Render's own GitHub
  integration — see the note in `render.yaml`).
- **Local dev**: `docker-compose.yml` runs the API the way Render builds it,
  plus a `postgres:16` stand-in for Neon. See the README's "Develop" section.
