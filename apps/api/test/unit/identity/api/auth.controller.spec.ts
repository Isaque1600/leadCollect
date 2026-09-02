import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { AuthController } from "../../../../src/modules/identity/api/auth.controller";
import { SignInWithGoogleUseCase } from "../../../../src/modules/identity/application/sign-in-with-google.use-case";
import { TokensService } from "../../../../src/modules/identity/application/tokens.service";
import type { User } from "../../../../src/modules/identity/domain/user";
import { FakeUsers, googleIdentity, storedUser } from "../fake-users";

const SECRET = "test-secret-that-is-long-enough";

function makeController(seed: User[] = [storedUser]) {
  const users = new FakeUsers(seed);
  const tokens = new TokensService(new JwtService({ secret: SECRET }));
  const controller = new AuthController(new SignInWithGoogleUseCase(users), tokens, {
    nodeEnv: "test",
    port: 3000,
    corsOrigins: ["http://localhost:5173"],
    webAppUrl: "http://localhost:5173",
  });
  return { controller, tokens, users };
}

describe("AuthController", () => {
  it("redirects to the SPA with a token the API can verify back", async () => {
    const { controller, tokens } = makeController();
    const redirect = vi.fn();
    const req = { user: googleIdentity } as unknown as Request;

    await controller.callback(req, { redirect } as unknown as Response);

    expect(redirect).toHaveBeenCalledOnce();
    const target = new URL(redirect.mock.calls[0]![0] as string);
    expect(target.origin).toBe("http://localhost:5173");
    const token = new URLSearchParams(target.hash.slice(1)).get("token")!;
    expect(tokens.verify(token).sub).toBe(storedUser.id);
  });

  it("signs an unknown Google identity in by creating the user first", async () => {
    const { controller, users } = makeController([]);
    const redirect = vi.fn();

    await controller.callback(
      { user: googleIdentity } as unknown as Request,
      {
        redirect,
      } as unknown as Response,
    );

    expect(users.createCalls).toBe(1);
  });

  it("returns the current user from GET /me without leaking google_id", () => {
    const { controller } = makeController();

    expect(controller.me(storedUser)).toEqual({
      id: storedUser.id,
      email: storedUser.email,
      name: storedUser.name,
      monthlyQuotaUsed: storedUser.monthlyQuotaUsed,
    });
  });
});
