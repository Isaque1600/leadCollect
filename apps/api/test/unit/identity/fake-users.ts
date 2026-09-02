import type { GoogleIdentity, User } from "../../../src/modules/identity/domain/user";
import type { Users } from "../../../src/modules/identity/domain/users.port";

/**
 * An in-memory stand-in for the `Users` port. Replaces the old thenable Drizzle
 * mock: the port is ours (ADR-0008), so a fake implementation is honest and
 * needs no Postgres. Drizzle's own SQL is exercised by integration tests.
 */
export class FakeUsers implements Users {
  readonly rows: User[] = [];
  createCalls = 0;
  updateProfileCalls = 0;

  constructor(seed: User[] = []) {
    this.rows.push(...seed);
  }

  async findById(id: string): Promise<User | undefined> {
    return this.rows.find((row) => row.id === id);
  }

  async findByGoogleId(googleId: string): Promise<User | undefined> {
    return this.rows.find((row) => row.googleId === googleId);
  }

  async create(identity: GoogleIdentity): Promise<User> {
    this.createCalls += 1;
    // Mirrors the database defaults: it owns `id`, `createdAt`, and the quota.
    const row: User = {
      id: `generated-${this.rows.length + 1}`,
      googleId: identity.googleId,
      email: identity.email,
      name: identity.name,
      monthlyQuotaUsed: 0,
      createdAt: new Date("2026-01-01T00:00:00Z"),
    };
    this.rows.push(row);
    return row;
  }

  async updateProfile(id: string, identity: GoogleIdentity): Promise<User> {
    this.updateProfileCalls += 1;
    const index = this.rows.findIndex((row) => row.id === id);
    const updated: User = { ...this.rows[index]!, email: identity.email, name: identity.name };
    this.rows[index] = updated;
    return updated;
  }
}

/** A user already in the store, used as the "returning sign-in" case. */
export const storedUser: User = {
  id: "11111111-1111-1111-1111-111111111111",
  googleId: "g-123",
  email: "lead.hunter@example.com",
  name: "Lead Hunter",
  monthlyQuotaUsed: 3,
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

export const googleIdentity: GoogleIdentity = {
  googleId: "g-123",
  email: "lead.hunter@example.com",
  name: "Lead Hunter",
};
