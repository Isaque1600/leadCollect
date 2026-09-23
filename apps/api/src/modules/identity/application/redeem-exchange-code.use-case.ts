import { Inject, Injectable } from "@nestjs/common";
import { EXCHANGE_CODES, type ExchangeCodes } from "../domain/exchange-codes.port";
import { USERS, type Users } from "../domain/users.port";
import { TokensService } from "./tokens.service";

/**
 * The one failure a redemption reports. Deliberately does not say whether the
 * code was unknown, expired or already used: the caller answers a bare 401.
 */
export class InvalidExchangeCodeError extends Error {
  constructor() {
    super("invalid exchange code");
    this.name = "InvalidExchangeCodeError";
  }
}

/**
 * Trades an exchange code for the JWT (`POST /auth/exchange`, ticket 19).
 */
@Injectable()
export class RedeemExchangeCodeUseCase {
  constructor(
    @Inject(EXCHANGE_CODES) private readonly codes: ExchangeCodes,
    @Inject(USERS) private readonly users: Users,
    private readonly tokens: TokensService,
  ) {}

  async execute(code: string): Promise<string> {
    // Taking the code removes it whatever happens next, so a code is spent by
    // its first redemption attempt even if that attempt is refused.
    const grant = await this.codes.take(code);
    if (!grant || grant.expiresAt.getTime() <= Date.now()) {
      throw new InvalidExchangeCodeError();
    }
    // The user can only be missing if the row was deleted after sign-in.
    const user = await this.users.findById(grant.userId);
    if (!user) throw new InvalidExchangeCodeError();
    return this.tokens.issue(user);
  }
}
