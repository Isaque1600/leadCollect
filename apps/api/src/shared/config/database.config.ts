import { registerAs } from "@nestjs/config";

/**
 * Neon connection strings (ADR-0006). The running app uses the **pooled** URL;
 * `drizzle-kit` migrations use the **direct** one, which the app itself never
 * opens — so it is not part of the validated boot environment.
 */
export const databaseConfig = registerAs("database", () => ({
  url: process.env.DATABASE_URL as string,
}));
