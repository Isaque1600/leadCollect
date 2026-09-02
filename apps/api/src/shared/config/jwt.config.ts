import { registerAs } from "@nestjs/config";

/**
 * Signing settings for the bearer token issued after sign-in (ADR-0001:
 * stateless JWT, no server-side session). `env.validation.ts` guarantees the
 * secret is present and long enough before this is ever read.
 */
export const jwtConfig = registerAs("jwt", () => ({
  secret: process.env.JWT_SECRET as string,
  expiresIn: "7d",
}));
