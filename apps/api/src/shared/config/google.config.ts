import { registerAs } from "@nestjs/config";

/**
 * The Google OAuth client used for sign-in only: scopes `openid email profile`,
 * no offline access and therefore no refresh token (ADR-0005).
 */
export const googleConfig = registerAs("google", () => ({
  clientId: process.env.GOOGLE_CLIENT_ID as string,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
  callbackUrl: process.env.GOOGLE_CALLBACK_URL as string,
}));
