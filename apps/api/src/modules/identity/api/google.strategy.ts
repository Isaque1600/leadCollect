import { Inject, Injectable } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, type Profile, type VerifyCallback } from "passport-google-oauth20";
import { googleConfig } from "../../../shared/config/google.config";
import type { GoogleIdentity } from "../domain/user";

/**
 * Google OAuth for identity only: scopes `openid email profile`, no offline
 * access and so no refresh token (ADR-0005). Credentials come from
 * `shared/config`'s `googleConfig`, which is validated at boot.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  constructor(@Inject(googleConfig.KEY) config: ConfigType<typeof googleConfig>) {
    super({
      clientID: config.clientId,
      clientSecret: config.clientSecret,
      callbackURL: config.callbackUrl,
      scope: ["openid", "email", "profile"],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      done(new Error("Google profile has no email"));
      return;
    }
    const identity: GoogleIdentity = {
      googleId: profile.id,
      email,
      name: profile.displayName || email,
    };
    done(null, identity);
  }
}
