import { randomBytes } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { User } from "../domain/user";
import { EXCHANGE_CODES, type ExchangeCodes } from "../domain/exchange-codes.port";

/**
 * How long an exchange code stays redeemable. The SPA redeems it as soon as the
 * callback route loads, so a minute is plenty.
 */
export const EXCHANGE_CODE_TTL_MS = 60_000;

/**
 * Mints the exchange code the sign-in redirect carries instead of the JWT
 * (ticket 19). The code is 32 random bytes, so it cannot be guessed; the store
 * keeps only its hash.
 */
@Injectable()
export class IssueExchangeCodeUseCase {
  constructor(@Inject(EXCHANGE_CODES) private readonly codes: ExchangeCodes) {}

  async execute(user: Pick<User, "id">): Promise<string> {
    const code = randomBytes(32).toString("base64url");
    await this.codes.save({
      code,
      userId: user.id,
      expiresAt: new Date(Date.now() + EXCHANGE_CODE_TTL_MS),
    });
    return code;
  }
}
