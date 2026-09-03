/**
 * Validation for the raw environment, run once by `ConfigModule.forRoot({
 * validate })` before anything is injected. Throwing here fails the process at
 * boot with a list of every problem, instead of an `undefined` surfacing later
 * as a 500 — or, worse, as a JWT signed with an empty secret.
 *
 * Deliberately a plain function: `@nestjs/config` accepts one, so there is no
 * reason to pull in a schema library for a handful of variables.
 */

/** Every variable the API reads, after validation and defaulting. */
export interface Env {
  NODE_ENV: string;
  PORT: number;
  CORS_ORIGINS: string;
  DATABASE_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_CALLBACK_URL: string;
  JWT_SECRET: string;
  WEB_APP_URL: string;
  GOOGLE_PLACES_API_KEY: string;
}

/** Variables with no sensible default — absent or blank is a boot failure. */
const REQUIRED = [
  "DATABASE_URL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_CALLBACK_URL",
  "JWT_SECRET",
  "WEB_APP_URL",
  "GOOGLE_PLACES_API_KEY",
] as const;

/** A signing secret shorter than this is not worth calling a secret. */
const MIN_JWT_SECRET_LENGTH = 16;

export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];
  const read = (key: string): string => String(raw[key] ?? "").trim();

  for (const key of REQUIRED) {
    if (read(key) === "") {
      errors.push(`${key} is required and must not be empty`);
    }
  }

  const jwtSecret = read("JWT_SECRET");
  if (jwtSecret !== "" && jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters`);
  }

  const rawPort = read("PORT");
  const port = rawPort === "" ? 3000 : Number(rawPort);
  if (!Number.isInteger(port) || port <= 0) {
    errors.push("PORT must be a positive integer");
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n  - ${errors.join("\n  - ")}`);
  }

  return {
    NODE_ENV: read("NODE_ENV") || "development",
    PORT: port,
    CORS_ORIGINS: read("CORS_ORIGINS") || "http://localhost:5173",
    DATABASE_URL: read("DATABASE_URL"),
    GOOGLE_CLIENT_ID: read("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: read("GOOGLE_CLIENT_SECRET"),
    GOOGLE_CALLBACK_URL: read("GOOGLE_CALLBACK_URL"),
    JWT_SECRET: jwtSecret,
    WEB_APP_URL: read("WEB_APP_URL"),
    GOOGLE_PLACES_API_KEY: read("GOOGLE_PLACES_API_KEY"),
  };
}
