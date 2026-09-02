import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { User } from "../db/schema";

const row: User = {
  id: "11111111-1111-1111-1111-111111111111",
  googleId: "g-123",
  email: "lead.hunter@example.com",
  name: "Lead Hunter",
  monthlyQuotaUsed: 3,
  createdAt: new Date(),
};

function contextWithAuthHeader(header?: string): ExecutionContext {
  const req: { headers: Record<string, string | undefined>; user?: User } = {
    headers: { authorization: header },
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

function makeGuard(findById: (id: string) => Promise<User | undefined>) {
  const jwt = new JwtService({ secret: "test-secret" });
  const auth = {
    verifyToken: (t: string) => jwt.verify(t),
    findById: vi.fn(findById),
  } as unknown as AuthService;
  return { guard: new JwtAuthGuard(auth), jwt };
}

describe("JwtAuthGuard", () => {
  it("passes and attaches the user for a valid bearer token", async () => {
    const { guard, jwt } = makeGuard(async () => row);
    const token = jwt.sign({ sub: row.id, email: row.email });
    const ctx = contextWithAuthHeader(`Bearer ${token}`);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
  });

  it("401 when the Authorization header is missing", async () => {
    const { guard } = makeGuard(async () => row);
    await expect(guard.canActivate(contextWithAuthHeader())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("401 when the token is not a Bearer scheme", async () => {
    const { guard, jwt } = makeGuard(async () => row);
    const token = jwt.sign({ sub: row.id, email: row.email });
    await expect(
      guard.canActivate(contextWithAuthHeader(`Basic ${token}`)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("401 when the token signature is invalid", async () => {
    const { guard } = makeGuard(async () => row);
    const foreign = new JwtService({ secret: "other" }).sign({ sub: row.id, email: row.email });
    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${foreign}`)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("401 when the token is valid but the user no longer exists", async () => {
    const { guard, jwt } = makeGuard(async () => undefined);
    const token = jwt.sign({ sub: row.id, email: row.email });
    await expect(
      guard.canActivate(contextWithAuthHeader(`Bearer ${token}`)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
