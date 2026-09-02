import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../../../shared/db/db.module";
import type { GoogleIdentity, User } from "../domain/user";
import type { Users } from "../domain/users.port";
import { users, type UserRow } from "./identity.schema";

/** The stored row and the domain type share a shape; the mapping stays explicit. */
function toUser(row: UserRow): User {
  return {
    id: row.id,
    googleId: row.googleId,
    email: row.email,
    name: row.name,
    monthlyQuotaUsed: row.monthlyQuotaUsed,
    createdAt: row.createdAt,
  };
}

/** The Drizzle-backed implementation of the {@link Users} port (ADR-0006/0008). */
@Injectable()
export class DrizzleUsersRepository implements Users {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findById(id: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return row && toUser(row);
  }

  async findByGoogleId(googleId: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return row && toUser(row);
  }

  async create(identity: GoogleIdentity): Promise<User> {
    const [row] = await this.db
      .insert(users)
      .values({
        googleId: identity.googleId,
        email: identity.email,
        name: identity.name,
      })
      .returning();
    return toUser(row!);
  }

  async updateProfile(id: string, identity: GoogleIdentity): Promise<User> {
    const [row] = await this.db
      .update(users)
      .set({ email: identity.email, name: identity.name })
      .where(eq(users.id, id))
      .returning();
    return toUser(row!);
  }
}
