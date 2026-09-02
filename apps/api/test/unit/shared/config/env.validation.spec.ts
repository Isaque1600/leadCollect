import { describe, expect, it } from "vitest";
import { validateEnv } from "../../../../src/shared/config/env.validation";

const complete = {
  DATABASE_URL: "postgresql://user:pw@ep-x-pooler.neon.tech/neondb",
  GOOGLE_CLIENT_ID: "client-id.apps.googleusercontent.com",
  GOOGLE_CLIENT_SECRET: "client-secret",
  GOOGLE_CALLBACK_URL: "http://localhost:3000/auth/google/callback",
  JWT_SECRET: "a-long-enough-signing-secret",
  WEB_APP_URL: "http://localhost:5173",
};

describe("validateEnv", () => {
  it("accepts a complete environment and applies the defaults", () => {
    const env = validateEnv({ ...complete });

    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toBe("http://localhost:5173");
    expect(env.NODE_ENV).toBe("development");
    expect(env.JWT_SECRET).toBe(complete.JWT_SECRET);
  });

  it("rejects a missing JWT_SECRET", () => {
    const { JWT_SECRET: _omitted, ...rest } = complete;

    expect(() => validateEnv(rest)).toThrow(/JWT_SECRET is required/);
  });

  it("rejects a blank JWT_SECRET", () => {
    expect(() => validateEnv({ ...complete, JWT_SECRET: "   " })).toThrow(/JWT_SECRET is required/);
  });

  it("rejects a JWT_SECRET that is too short to be a secret", () => {
    expect(() => validateEnv({ ...complete, JWT_SECRET: "short" })).toThrow(
      /JWT_SECRET must be at least/,
    );
  });

  it("reports every missing variable at once", () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*WEB_APP_URL/);
  });

  it("rejects a non-numeric PORT", () => {
    expect(() => validateEnv({ ...complete, PORT: "not-a-port" })).toThrow(
      /PORT must be a positive integer/,
    );
  });
});
