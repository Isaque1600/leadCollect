import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it } from "vitest";
import { TokensService } from "../../../../src/modules/identity/application/tokens.service";
import { JwtAuthGuard } from "../../../../src/modules/identity/api/jwt-auth.guard";
import type { User } from "../../../../src/modules/identity/domain/user";
import { FakeUsers, storedUser } from "../fake-users";

const SECRET = "test-secret-that-is-long-enough";

function contextWithAuthHeader(header?: string): {
  ctx: ExecutionContext;
  req: { headers: Record<string, string | undefined>; user?: User };
} {
  const req: { headers: Record<string, string | undefined>; user?: User } = {
    headers: { authorization: header },
  };
  return {
    req,
    ctx: {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext,
  };
}

function makeGuard(seed: User[] = [storedUser]) {
  const jwt = new JwtService({ secret: SECRET });
  const tokens = new TokensService(jwt);
  return { guard: new JwtAuthGuard(tokens, new FakeUsers(seed)), tokens };
}

describe("JwtAuthGuard", () => {
  it("passes and attaches the user for a valid bearer token", async () => {
    const { guard, tokens } = makeGuard();
    const { ctx, req } = contextWithAuthHeader(`Bearer ${tokens.issue(storedUser)}`);

    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual(storedUser);
  });

  it("401 when the Authorization header is missing", async () => {
    const { guard } = makeGuard();

    await expect(guard.canActivate(contextWithAuthHeader().ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("401 when the token is not a Bearer scheme", async () => {
    const { guard, tokens } = makeGuard();

    await expect(
      guard.canActivate(contextWithAuthHeader(`Basic ${tokens.issue(storedUser)}`).ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("401 when the token signature is invalid", async () => {
    const { guard } = makeGuard();
    const foreign = new TokensService(new JwtService({ secret: "other-secret-entirely" })).issue(
      storedUser,
    );

    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${foreign}`).ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("401 when the token is valid but the user no longer exists", async () => {
    const { guard, tokens } = makeGuard([]);

    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${tokens.issue(storedUser)}`).ctx),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
