import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../../../shared/db/db.module";
import type { ExchangeCode, ExchangeCodeGrant, ExchangeCodes } from "../domain/exchange-codes.port";
import { authExchangeCodes } from "./identity.schema";

/**
 * A plain SHA-256 is enough here, unlike for a password: an exchange code is 32
 * random bytes, so there is nothing to brute-force, and it lives a minute.
 */
function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

/** The Drizzle-backed implementation of the {@link ExchangeCodes} port. */
@Injectable()
export class DrizzleExchangeCodes implements ExchangeCodes {
  constructor(@Inject(DB) private readonly db: Database) {}

  async save({ code, userId, expiresAt }: ExchangeCode): Promise<void> {
    await this.db.insert(authExchangeCodes).values({ codeHash: hashCode(code), userId, expiresAt });
  }

  /**
   * One `DELETE … RETURNING`: Postgres lets only one of two concurrent deletes
   * of the same row see it, so a code cannot be redeemed twice.
   */
  async take(code: string): Promise<ExchangeCodeGrant | undefined> {
    const [row] = await this.db
      .delete(authExchangeCodes)
      .where(eq(authExchangeCodes.codeHash, hashCode(code)))
      .returning({ userId: authExchangeCodes.userId, expiresAt: authExchangeCodes.expiresAt });
    return row;
  }
}
