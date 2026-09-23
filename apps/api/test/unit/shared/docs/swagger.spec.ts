import type { INestApplication } from "@nestjs/common";
import type { OpenAPIObject } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AppModule } from "../../../../src/app.module";
import { setupSwagger } from "../../../../src/shared/docs/swagger";

/**
 * The OpenAPI document as `main.ts` builds it, from the real `AppModule`. The
 * Postgres client connects lazily, so booting the module needs only a valid
 * environment, not a database.
 *
 * `ConfigModule.forRoot` validates the environment when `AppModule` is
 * imported, so the variables are set in `vi.hoisted`, ahead of the imports.
 *
 * vitest compiles with SWC, which does not run the `@nestjs/swagger` CLI
 * plugin, so plugin-inferred schemas are absent here. These tests pin paths and
 * security, which do not depend on the plugin.
 */
vi.hoisted(() => {
  Object.assign(process.env, {
    DATABASE_URL: "postgresql://user:pw@localhost:5432/unused",
    GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
    GOOGLE_CLIENT_SECRET: "client-secret",
    GOOGLE_CALLBACK_URL: "http://localhost:3000/auth/google/callback",
    JWT_SECRET: "a-long-enough-signing-secret",
    WEB_APP_URL: "http://localhost:5173",
    GOOGLE_PLACES_API_KEY: "places-api-key",
  });
});

describe("OpenAPI docs", () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    document = setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it("documents every route the API serves", () => {
    expect(Object.keys(document.paths).sort()).toEqual([
      "/auth/google",
      "/auth/google/callback",
      "/health",
      "/jobs",
      "/jobs/{id}",
      "/me",
    ]);
  });

  it.each([
    ["get", "/me"],
    ["post", "/jobs"],
    ["get", "/jobs/{id}"],
  ] as const)("marks %s %s as needing the bearer token", (method, path) => {
    expect(document.components?.securitySchemes?.bearer).toMatchObject({
      type: "http",
      scheme: "bearer",
    });
    expect(document.paths[path]?.[method]?.security).toEqual([{ bearer: [] }]);
  });

  it.each(["/health", "/auth/google", "/auth/google/callback"])("leaves GET %s public", (path) => {
    expect(document.security ?? []).toEqual([]);
    expect(document.paths[path]?.get?.security ?? []).toEqual([]);
  });

  describe("over HTTP", () => {
    let baseUrl: string;

    beforeAll(async () => {
      await app.listen(0, "127.0.0.1");
      baseUrl = await app.getUrl();
    });

    it("serves the raw OpenAPI document at /docs-json", async () => {
      const res = await fetch(`${baseUrl}/docs-json`);

      expect(res.status).toBe(200);
      const body = (await res.json()) as OpenAPIObject;
      expect(body.info.title).toBe("Lead Collector API");
      expect(body.paths).toHaveProperty("/jobs/{id}");
    });

    it("serves Swagger UI at /docs", async () => {
      const res = await fetch(`${baseUrl}/docs`);

      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/text\/html/);
      expect(await res.text()).toContain("swagger-ui");
    });
  });
});
