import { Inject, Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type { AuthTokenClaims } from "@olc/types";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../db/db.module";
import { users, type User } from "../db/schema";

/** The identity fields we take from a Google `openid email profile` profile. */
export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string;
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  /**
   * First sign-in inserts a `users` row; later sign-ins match on `google_id`
   * and refresh the stored email/name.
   */
  async upsertGoogleUser(identity: GoogleIdentity): Promise<User> {
    const [existing] = await this.db
      .select()
      .from(users)
      .where(eq(users.googleId, identity.googleId))
      .limit(1);

    if (existing) {
      if (existing.email === identity.email && existing.name === identity.name) {
        return existing;
      }
      const [updated] = await this.db
        .update(users)
        .set({ email: identity.email, name: identity.name })
        .where(eq(users.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await this.db
      .insert(users)
      .values({
        googleId: identity.googleId,
        email: identity.email,
        name: identity.name,
      })
      .returning();
    return created!;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  /** Signs the bearer token the SPA stores and replays on every API call. */
  issueToken(user: Pick<User, "id" | "email">): string {
    const claims: AuthTokenClaims = { sub: user.id, email: user.email };
    return this.jwt.sign(claims);
  }

  verifyToken(token: string): AuthTokenClaims {
    return this.jwt.verify<AuthTokenClaims>(token);
  }
}
