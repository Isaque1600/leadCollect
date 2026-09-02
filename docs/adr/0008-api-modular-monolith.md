# API is a modular monolith with four folders per module

`apps/api` is organised as a modular monolith. Each module is a folder under
`src/modules/` split into `domain/`, `application/`, `api/`, and `infra/`.
Dependencies point inward: `domain/` imports nothing outside itself, and
`shared/` never imports from `modules/`.

Code lives in `shared/` only when two or more modules genuinely use it. Anything
scoped to one module stays in that module and is imported by name — the bearer
token guard, for example, lives in `modules/identity/api/` because it needs the
identity module's token and user interfaces, and putting it in `shared/` would
make `shared/` depend on a module.

## The module seam is NestJS's own

A module's public surface is its `@Module({ providers, exports })` declaration.
We do not hand-roll barrel files, a custom DI container, or bespoke module
registration. The framework already provides modules, dependency injection,
guards, pipes, interceptors, and lifecycle hooks — if we reinvent them there is
no reason to be on NestJS at all. Use the framework's primitives first and reach
for something custom only when they genuinely do not fit.

Caveat: `exports` governs DI visibility, not file imports — TypeScript will still
resolve a deep path into another module's `infra/`. That is convention-enforced
for now; an ESLint `no-restricted-imports` rule is the escalation if it is ever
violated.

## Adopted first-party packages

Before building API plumbing, check what NestJS already ships (installed
`@nestjs/*` packages first, then the docs) and prefer it. Adopted so far:

- **`@nestjs/config`** — `shared/config/` uses `ConfigModule` for the `.env`
  cascade and validation, exposing typed namespaces via `registerAs()` +
  `ConfigType<>` rather than stringly-typed `ConfigService.get()`. Nothing else
  reads `process.env`.
- **`@nestjs/terminus`** — the health module uses `HealthCheckService`. Its
  response keeps a top-level `status: "ok"`, so the SPA's `HealthResponse`
  contract is unchanged.

`/health` deliberately reports **liveness only** — it does not include a database
indicator. Render probes this path on every deploy, so a database blip reporting
through `/health` would fail the health check and block deploys for a fault the
process has not actually suffered. Readiness (including database connectivity)
belongs on a separate endpoint if we ever need it.

## Domain style

Types and pure functions, not rich entities. The domain layer holds plain type
declarations and pure rules, with no framework decorators and no imports from
`infra/` or `shared/db`. The database generates `id`, `created_at`, and other
defaults — application code never does.

## Schema placement

Each module declares its own tables in `<module>/infra/<module>.schema.ts`.
`drizzle-kit` finds them by glob (`./src/modules/**/*.schema.ts`); the runtime
connection object is assembled in `src/schema.ts` at the composition root, which
is already the one place allowed to know every module.

We rejected centralising every table under `shared/db/schemas/` (the shape
Prisma pushes you toward): it would make `shared/` carry module-specific
knowledge, contradicting the dependency rule above, and it weakens module
ownership as modules multiply. Drizzle schemas are ordinary TypeScript modules,
so they can live where they are owned.

Repositories are ours, not Drizzle's — Drizzle has no repository pattern. Each
module declares a port in `domain/` and a Drizzle adapter in `infra/`.

## Tests

Tests live outside `src/`, in `test/unit/` and `test/integration/`, mirroring the
module and layer structure: `test/unit/identity/application/
sign-in-with-google.use-case.spec.ts`. Unit tests need no infrastructure and run
in CI; integration tests need the local Postgres from ticket 15 and run under a
separate config and script.
