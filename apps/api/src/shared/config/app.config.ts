import { registerAs } from "@nestjs/config";

/**
 * Process-level settings: what the HTTP server binds to, which browser origins
 * may talk to it, and where the SPA lives. Injected as
 * `ConfigType<typeof appConfig>`, never read back out of `ConfigService` by
 * string key.
 */
export const appConfig = registerAs("app", () => ({
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 3000),
  corsOrigins: (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  /** The SPA origin the sign-in callback redirects back to. */
  webAppUrl: process.env.WEB_APP_URL as string,
}));
