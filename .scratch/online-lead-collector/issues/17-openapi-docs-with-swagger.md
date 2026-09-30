# 17: Auto-generated API docs with @nestjs/swagger

**What to build:** The API serves live, auto-generated OpenAPI documentation, so
every endpoint, its request shape, its response shape, and its auth requirement
are readable without opening the source — and testable from the browser.

Uses `@nestjs/swagger` plus its **CLI plugin**, which infers most schema
information from the TypeScript types already on the DTOs. That keeps decorator
noise low: annotate what the compiler cannot know (descriptions, examples,
non-obvious status codes), not every property.

**Blocked by:** 02

**Status:** done (branch feature/17-openapi-swagger, PR #11)

- [x] `@nestjs/swagger` installed; the CLI plugin enabled in `nest-cli.json` (`plugins: ["@nestjs/swagger"]`)
- [x] `SwaggerModule` wired in `main.ts` from a `DocumentBuilder` (title, description, version)
- [x] `addBearerAuth()` configured so a JWT can be pasted into Swagger UI and used to call guarded routes
- [x] Docs served at `/docs`; the raw OpenAPI JSON available at `/docs-json`
- [x] Guarded routes carry `@ApiBearerAuth()`; `/health` and the Google sign-in routes are marked public
- [x] Request/response DTOs live in the owning module's `api/` folder — Swagger decorators never appear in `domain/` or `application/` (ADR-0008)
- [x] Whether `/docs` is exposed in the prod environment is a deliberate, documented choice (see Notes)
- [x] Unit test asserting the OpenAPI document builds and contains the expected paths

## Notes

- **Exposure**: this is a personal-scale tool and the API surface is not secret,
  so serving `/docs` in both environments is defensible. The alternative is
  gating it behind the dev environment only. Ask the user which they want rather
  than assuming — it is a security-shaped decision.
- The CLI plugin only reads DTO **classes**, not interfaces. Shared types in
  `@olc/types` stay interfaces for the SPA; the API's `api/` layer declares
  classes that implement them where Swagger needs to see the shape.
- Follow-up worth its own ticket if it ever becomes useful: generate the SPA's
  client types from `/docs-json` instead of hand-writing them in `@olc/types`.

## Implementation notes

- **Exposure, decided by the user:** `/docs` and `/docs-json` are served in
  dev and prod alike. It is a personal-scale tool, the API surface is not
  secret, and guarded routes still need a JWT. This is recorded in the README
  ("API docs") and in a comment in `main.ts`.
- `setupSwagger(app)` lives in `apps/api/src/shared/docs/swagger.ts`, and
  `main.ts` and `test/unit/shared/docs/swagger.spec.ts` both call it. The test
  boots the real `AppModule` and checks the path list, bearer security on
  `/me`, `POST /jobs` and `GET /jobs/{id}`, no security on `/health` and the
  Google routes, and `/docs` plus `/docs-json` over HTTP.
- "Marked public" means the route has no security requirement. There is no
  global requirement in the `DocumentBuilder`, and guarded routes opt in with
  `@ApiBearerAuth()`.
- The CLI plugin runs under `nest build` (the tsc builder), and the built
  `dist/` carries `_OPENAPI_METADATA_FACTORY` on every `*.dto.ts` class. vitest
  compiles with SWC and does **not** run the plugin, so DTO schemas are absent
  from the document in unit tests. The tests assert only paths and security for
  that reason. Schemas were checked by hand against the built app's
  `/docs-json`.
- Response classes: `identity/api/me-response.dto.ts` and
  `jobs/api/job-responses.dto.ts` `implements` the `@olc/types` interfaces and
  have no decorators. The plugin infers the `JobStatus` union as an enum and
  `string | null` as nullable. The files must end in `.dto.ts`, the plugin's
  default suffix.
- `@nestjs/swagger` 11.4.7, pinned (12.x targets Nest 12). `swagger-ui-dist`
  pulls in `@scarf/scarf`, an install-time telemetry script. It is set to
  `false` in `pnpm-workspace.yaml`'s `allowBuilds`.
- Follow-up: routes added later need `@ApiBearerAuth()` if they are guarded,
  plus their response DTO classes. Ticket 19's `POST /auth/exchange` is the
  first of these.

## Review fixes (PR #11, first review)

- ADR-0008 now lists `@nestjs/swagger` under "Adopted first-party packages":
  the CLI plugin, `*.dto.ts` classes that `implements` `@olc/types`, and
  Swagger decorators only in `api/` and `shared/docs/`.
- `nest-cli.json` turns on the plugin's `introspectComments`. DTO property doc
  comments become schema descriptions, and a route handler's doc comment
  becomes its operation summary, with `@remarks` as the description. Doc
  comments in `api/` are therefore written for API callers. Maintainer notes
  that were in doc comments (ADR-0003, ticket 09, `ParseUUIDPipe`, `@Type`)
  moved to `//` comments, which the plugin ignores. `@example` tags on
  `StartJobDto` fill Swagger UI's "Try it out" body.
- Schema fidelity:
  - `@IsNotEmpty()` became `@MinLength(1, NOT_BLANK)` on `StartJobDto`. The
    plugin reads `@MinLength` as `minLength: 1` but has no mapping for
    `@IsNotEmpty`. The message stays "… should not be empty", because the
    SPA shows it, and a unit test pins it.
  - `maxResults`: `@ApiProperty({ type: "integer" })`. The plugin has no
    mapping for `@IsInt`, so this is the one hand-written property decorator.
    The plugin still adds `minimum`/`maximum`. A side effect is that
    `maxResults` is listed first in the schema, because explicit decorators
    register before the plugin's metadata.
  - `GET /jobs/{id}`: `@ApiParam({ name: "id", format: "uuid" })`. The
    document generator does not look at pipes, so `ParseUUIDPipe` alone does
    not produce the format.
- `/health`: `@HealthCheck({ noCache: true, swaggerDocumentation: false })`
  drops Terminus's generated entry, which showed a `database` indicator and a
  503 that cannot happen here. An `@ApiOkResponse` documents the actual
  liveness body instead.
- New unit tests cover the uuid param, `maxResults` as `integer`, and
  `/health` with no database indicator. These come from hand-written
  decorators, so they survive SWC.
- **Not done: `POST /auth/exchange` (PR #10).** PR #10 was still open when
  these fixes were made, so `dev` was not merged in. Whichever of #10 and #11
  lands second has to document `/auth/exchange` (response DTO class plus
  `@ApiUnauthorizedResponse`), add it to `swagger.spec.ts`'s route list, and
  update the callback's doc comment and 302 description in
  `auth.controller.ts`, which still say "URL fragment".
- **Follow-up, not done:** schema tests. vitest/SWC skips the plugin, so
  plugin-inferred schemas are untested. Nest's fix is `PluginMetadataGenerator`
  (from `@nestjs/cli`) to emit a `metadata.ts` plus
  `SwaggerModule.loadPluginMetadata()` in `setupSwagger`, which would let
  `swagger.spec.ts` assert the schemas too.
- Response counters (`queriesTotal`, `leadsFound`, …, `monthlyQuotaUsed`) are
  still documented as `number`, not `integer`. The review only flagged
  `maxResults`, and fixing those would take one hand-written decorator per
  field.
