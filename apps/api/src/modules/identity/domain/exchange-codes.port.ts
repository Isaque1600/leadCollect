/** Injection token for the {@link ExchangeCodes} port. */
export const EXCHANGE_CODES = Symbol("ExchangeCodes");

/**
 * A short-lived, single-use code handed to the SPA in the sign-in redirect in
 * place of the JWT itself. The SPA trades it for the JWT with
 * `POST /auth/exchange`, so the token never appears in a URL.
 */
export interface ExchangeCode {
  code: string;
  userId: string;
  expiresAt: Date;
}

/** What a stored exchange code was issued for. */
export type ExchangeCodeGrant = Omit<ExchangeCode, "code">;

/**
 * Where issued exchange codes wait to be redeemed. Declared here, implemented
 * by the Drizzle adapter in `infra/` (ADR-0008); tests substitute a fake.
 *
 * Implementations must not keep the code in a usable form: the stored value is
 * a hash, for the same reason passwords are hashed.
 */
export interface ExchangeCodes {
  save(code: ExchangeCode): Promise<void>;

  /**
   * Removes the code and returns what it was issued for, or `undefined` if no
   * such code is stored. Atomic: if two callers take the same code at once, at
   * most one of them gets it. Expiry is the caller's rule, not the store's, so
   * an expired code is still removed and returned.
   */
  take(code: string): Promise<ExchangeCodeGrant | undefined>;
}
