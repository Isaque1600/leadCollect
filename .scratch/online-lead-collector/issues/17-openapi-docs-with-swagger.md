# 17: Auto-generated API docs with @nestjs/swagger

**What to build:** The API serves live, auto-generated OpenAPI documentation, so
every endpoint, its request shape, its response shape, and its auth requirement
are readable without opening the source — and testable from the browser.

Uses `@nestjs/swagger` plus its **CLI plugin**, which infers most schema
information from the TypeScript types already on the DTOs. That keeps decorator
noise low: annotate what the compiler cannot know (descriptions, examples,
non-obvious status codes), not every property.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] `@nestjs/swagger` installed; the CLI plugin enabled in `nest-cli.json` (`plugins: ["@nestjs/swagger"]`)
- [ ] `SwaggerModule` wired in `main.ts` from a `DocumentBuilder` (title, description, version)
- [ ] `addBearerAuth()` configured so a JWT can be pasted into Swagger UI and used to call guarded routes
- [ ] Docs served at `/docs`; the raw OpenAPI JSON available at `/docs-json`
- [ ] Guarded routes carry `@ApiBearerAuth()`; `/health` and the Google sign-in routes are marked public
- [ ] Request/response DTOs live in the owning module's `api/` folder — Swagger decorators never appear in `domain/` or `application/` (ADR-0008)
- [ ] Whether `/docs` is exposed in the prod environment is a deliberate, documented choice (see Notes)
- [ ] Unit test asserting the OpenAPI document builds and contains the expected paths

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
