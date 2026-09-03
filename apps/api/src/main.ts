import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { appConfig } from "./shared/config/app.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Typed config, not process.env — `shared/config` validated it at boot.
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

  // Nest's own pipe over class-validator decorators on the request DTOs, rather
  // than hand-written checks in each controller. `whitelist` drops undeclared
  // properties, `forbidNonWhitelisted` turns them into a 400 so a typo in the
  // SPA is loud, and `transform` gives handlers real DTO instances with the
  // declared types (`"20"` arrives as `20`).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.enableCors({
    origin: config.corsOrigins,
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // Lets DbModule's onApplicationShutdown drain the Postgres pool on SIGTERM.
  app.enableShutdownHooks();

  await app.listen(config.port, "0.0.0.0");
  console.log(`API listening on :${config.port} (CORS: ${config.corsOrigins.join(", ")})`);
}

void bootstrap();
