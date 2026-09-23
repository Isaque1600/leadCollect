import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

/**
 * Builds the OpenAPI document from every controller in the app and serves it:
 * Swagger UI at `/docs`, the raw document at `/docs-json`.
 *
 * `main.ts` and the tests both call this, so the tests check the same wiring
 * that runs in production.
 */
export function setupSwagger(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle("Lead Collector API")
    .setDescription("Finds business Leads from Google Maps and web search.")
    .setVersion("0.0.0")
    // Registers the `bearer` scheme that `@ApiBearerAuth()` refers to, and adds
    // the Authorize button where a JWT from sign-in can be pasted.
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  // Swagger UI at `/docs`, raw JSON at `/docs-json` (the `-json` suffix is the
  // module's default).
  SwaggerModule.setup("docs", app, document);
  return document;
}
