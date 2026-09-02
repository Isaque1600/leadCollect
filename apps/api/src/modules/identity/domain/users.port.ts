import type { GoogleIdentity, User } from "./user";

/** Injection token for the {@link Users} port. */
export const USERS = Symbol("Users");

/**
 * How the identity module reaches its stored users. Drizzle has no repository
 * pattern, so the port is declared here in `domain/` and the Drizzle adapter
 * implementing it lives in `infra/` (ADR-0008). Tests substitute a fake.
 */
export interface Users {
  findById(id: string): Promise<User | undefined>;

  findByGoogleId(googleId: string): Promise<User | undefined>;

  /** Inserts a new user; the database generates `id` and `createdAt`. */
  create(identity: GoogleIdentity): Promise<User>;

  /** Refreshes the stored email and name after Google reports a change. */
  updateProfile(id: string, identity: GoogleIdentity): Promise<User>;
}
