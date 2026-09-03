import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { appConfig } from "./app.config";
import { databaseConfig } from "./database.config";
import { validateEnv } from "./env.validation";
import { googleConfig } from "./google.config";
import { jwtConfig } from "./jwt.config";
import { placesConfig } from "./places.config";

/**
 * The one place that reads `process.env`. Wraps `@nestjs/config` so the rest of
 * the API injects typed namespaces (`ConfigType<typeof jwtConfig>`) instead of
 * stringly-typed `ConfigService.get("JWT_SECRET")` calls.
 *
 * The env cascade matches ADR-0007's two environments:
 * `.env.<NODE_ENV>.local` holds the real credentials and is gitignored, while
 * `.env.example` documents the keys. On Render there is no file at all and the
 * platform's own variables are used, which is why a missing file is not an
 * error — a missing *value* still is, via `validate`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: [`.env.${process.env.NODE_ENV ?? "development"}.local`, ".env"],
      load: [appConfig, databaseConfig, googleConfig, jwtConfig, placesConfig],
      validate: validateEnv,
    }),
  ],
})
export class AppConfigModule {}
