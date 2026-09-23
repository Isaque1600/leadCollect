import { JwtService } from "@nestjs/jwt";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IssueExchangeCodeUseCase } from "../../../../src/modules/identity/application/issue-exchange-code.use-case";
import {
  InvalidExchangeCodeError,
  RedeemExchangeCodeUseCase,
} from "../../../../src/modules/identity/application/redeem-exchange-code.use-case";
import { TokensService } from "../../../../src/modules/identity/application/tokens.service";
import { FakeExchangeCodes } from "../fake-exchange-codes";
import { FakeUsers, storedUser } from "../fake-users";

const SECRET = "test-secret-that-is-long-enough";

function makeUseCases() {
  const codes = new FakeExchangeCodes();
  const tokens = new TokensService(new JwtService({ secret: SECRET }));
  return {
    tokens,
    issue: new IssueExchangeCodeUseCase(codes),
    redeem: new RedeemExchangeCodeUseCase(codes, new FakeUsers([storedUser]), tokens),
  };
}

describe("RedeemExchangeCodeUseCase", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("trades a freshly issued exchange code for the signed-in user's JWT", async () => {
    const { issue, redeem, tokens } = makeUseCases();
    const code = await issue.execute(storedUser);

    const token = await redeem.execute(code);

    expect(tokens.verify(token)).toMatchObject({
      sub: "11111111-1111-1111-1111-111111111111",
      email: "lead.hunter@example.com",
    });
  });

  it("refuses an exchange code that was never issued", async () => {
    const { redeem } = makeUseCases();

    await expect(redeem.execute("never-issued")).rejects.toBeInstanceOf(InvalidExchangeCodeError);
  });

  it("refuses a replay of an exchange code that was already redeemed", async () => {
    const { issue, redeem } = makeUseCases();
    const code = await issue.execute(storedUser);
    await redeem.execute(code);

    await expect(redeem.execute(code)).rejects.toBeInstanceOf(InvalidExchangeCodeError);
  });

  it("refuses an exchange code redeemed after it expired", async () => {
    vi.useFakeTimers({ now: new Date("2026-09-22T12:00:00Z") });
    const { issue, redeem } = makeUseCases();
    const code = await issue.execute(storedUser);

    // Codes live for one minute.
    vi.setSystemTime(new Date("2026-09-22T12:01:01Z"));

    await expect(redeem.execute(code)).rejects.toBeInstanceOf(InvalidExchangeCodeError);
  });
});
