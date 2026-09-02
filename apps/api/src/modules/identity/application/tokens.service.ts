import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthTokenClaims } from "@olc/types";
import type { User } from "../domain/user";

/**
 * Issues and verifies the bearer token the SPA stores and replays on every API
 * call (ADR-0001: stateless JWT, no server-side session). The signing secret and
 * lifetime come from `shared/config`'s `jwtConfig`, applied where `JwtModule` is
 * registered in `identity.module.ts`.
 */
@Injectable()
export class TokensService {
  constructor(private readonly jwt: JwtService) {}

  issue(user: Pick<User, "id" | "email">): string {
    const claims: AuthTokenClaims = { sub: user.id, email: user.email };
    return this.jwt.sign(claims);
  }

  /** Throws if the token is malformed, expired, or signed with another secret. */
  verify(token: string): AuthTokenClaims {
    return this.jwt.verify<AuthTokenClaims>(token);
  }
}
