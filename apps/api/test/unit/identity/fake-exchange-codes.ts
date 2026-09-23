import type {
  ExchangeCode,
  ExchangeCodeGrant,
  ExchangeCodes,
} from "../../../src/modules/identity/domain/exchange-codes.port";

/**
 * An in-memory stand-in for the `ExchangeCodes` port. Hashing and the atomic
 * single-use delete are the Drizzle adapter's job, covered by its integration
 * test against Postgres.
 */
export class FakeExchangeCodes implements ExchangeCodes {
  private readonly rows = new Map<string, ExchangeCodeGrant>();

  async save({ code, userId, expiresAt }: ExchangeCode): Promise<void> {
    this.rows.set(code, { userId, expiresAt });
  }

  async take(code: string): Promise<ExchangeCodeGrant | undefined> {
    const row = this.rows.get(code);
    this.rows.delete(code);
    return row;
  }
}
