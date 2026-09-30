import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test } from "@nestjs/testing";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AuthController } from "../../../../src/modules/identity/api/auth.controller";
import { IssueExchangeCodeUseCase } from "../../../../src/modules/identity/application/issue-exchange-code.use-case";
import { RedeemExchangeCodeUseCase } from "../../../../src/modules/identity/application/redeem-exchange-code.use-case";
import { SignInWithGoogleUseCase } from "../../../../src/modules/identity/application/sign-in-with-google.use-case";
import { TokensService } from "../../../../src/modules/identity/application/tokens.service";
import { EXCHANGE_CODES } from "../../../../src/modules/identity/domain/exchange-codes.port";
import { USERS } from "../../../../src/modules/identity/domain/users.port";
import { appConfig } from "../../../../src/shared/config/app.config";
import { FakeExchangeCodes } from "../fake-exchange-codes";
import { FakeUsers, storedUser } from "../fake-users";

const SECRET = "test-secret-that-is-long-enough";

/**
 * `POST /auth/exchange` over real HTTP: the status code and the error body are
 * part of the contract, and a direct method call sees neither. The app is the
 * identity controller with fake stores behind the ports, and the same global
 * `ValidationPipe` settings as `main.ts`.
 */
describe("POST /auth/exchange", () => {
  let app: INestApplication;
  let baseUrl: string;
  let issue: IssueExchangeCodeUseCase;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: SECRET })],
      controllers: [AuthController],
      providers: [
        SignInWithGoogleUseCase,
        IssueExchangeCodeUseCase,
        RedeemExchangeCodeUseCase,
        TokensService,
        { provide: USERS, useValue: new FakeUsers([storedUser]) },
        { provide: EXCHANGE_CODES, useValue: new FakeExchangeCodes() },
        {
          provide: appConfig.KEY,
          useValue: {
            nodeEnv: "test",
            port: 0,
            corsOrigins: ["http://localhost:5173"],
            webAppUrl: "http://localhost:5173",
          },
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.listen(0, "127.0.0.1");
    baseUrl = await app.getUrl();
    issue = app.get(IssueExchangeCodeUseCase);
  });

  afterAll(async () => {
    await app.close();
  });

  function exchange(body: unknown) {
    return fetch(`${baseUrl}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("answers 200 with the signed-in user's JWT in the body", async () => {
    const code = await issue.execute(storedUser);

    const res = await exchange({ code });

    expect(res.status).toBe(200);
    const { token } = (await res.json()) as { token: string };
    expect(new JwtService({ secret: SECRET }).verify(token)).toMatchObject({
      sub: "11111111-1111-1111-1111-111111111111",
      email: "lead.hunter@example.com",
    });
  });

  it("answers the same bare 401 for an unknown, an expired and an already-used code", async () => {
    const used = await issue.execute(storedUser);
    await exchange({ code: used });

    // Only `Date` is faked, so the HTTP server's own timers keep running.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-09-22T12:00:00Z") });
    const expired = await issue.execute(storedUser);
    vi.setSystemTime(new Date("2026-09-22T12:05:00Z"));

    const responses = await Promise.all([
      exchange({ code: "never-issued" }),
      exchange({ code: expired }),
      exchange({ code: used }),
    ]);
    vi.useRealTimers();

    const bodies = await Promise.all(responses.map((res) => res.json()));
    expect(responses.map((res) => res.status)).toEqual([401, 401, 401]);
    expect(bodies).toEqual([
      { statusCode: 401, message: "Unauthorized" },
      { statusCode: 401, message: "Unauthorized" },
      { statusCode: 401, message: "Unauthorized" },
    ]);
  });
});
