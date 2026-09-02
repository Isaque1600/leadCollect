import "reflect-metadata";
import { ConfigType } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { appConfig } from "./shared/config/app.config";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Typed config, not process.env — `shared/config` validated it at boot.
  const config = app.get<ConfigType<typeof appConfig>>(appConfig.KEY);

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
