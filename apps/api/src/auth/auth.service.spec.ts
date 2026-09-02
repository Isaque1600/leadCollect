import { JwtService } from "@nestjs/jwt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthService, type GoogleIdentity } from "./auth.service";
import type { Database } from "../db/db.module";
import type { User } from "../db/schema";

/**
 * A stand-in for the Drizzle handle. Every builder method returns the same
 * thenable, which resolves to whatever `queue` is set to for that call. No
 * Postgres involved — see ticket 02, database constraint.
 */
function makeDb() {
  let result: unknown[] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ["select", "from", "where", "limit", "insert", "values", "update", "set", "returning"]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return {
    db: builder as unknown as Database,
    setResult: (r: unknown[]) => {
      result = r;
    },
  };
}

const identity: GoogleIdentity = {
  googleId: "g-123",
  email: "lead.hunter@example.com",
  name: "Lead Hunter",
};

const row: User = {
  id: "11111111-1111-1111-1111-111111111111",
  googleId: "g-123",
  email: "lead.hunter@example.com",
  name: "Lead Hunter",
  monthlyQuotaUsed: 0,
  createdAt: new Date(),
};

describe("AuthService", () => {
  let jwt: JwtService;

  beforeEach(() => {
    jwt = new JwtService({ secret: "test-secret", signOptions: { expiresIn: "1h" } });
  });

  it("inserts a users row on first sign-in", async () => {
    const { db, setResult } = makeDb();
    const service = new AuthService(db, jwt);
    // first select -> no match; insert().returning() -> created row
    let call = 0;
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
      call += 1;
      return db;
    });
    setResult([]);
    const insertSpy = db.insert as ReturnType<typeof vi.fn>;
    // returning() resolves to [row] via a fresh thenable
    (db.returning as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      then: (r: (v: unknown) => unknown) => r([row]),
    }));

    const created = await service.upsertGoogleUser(identity);
    expect(created).toEqual(row);
    expect(insertSpy).toHaveBeenCalledOnce();
    expect(call).toBe(1);
  });

  it("matches on google_id for a returning user and does not insert", async () => {
    const { db, setResult } = makeDb();
    const service = new AuthService(db, jwt);
    setResult([row]);
    const insertSpy = db.insert as ReturnType<typeof vi.fn>;

    const found = await service.upsertGoogleUser(identity);
    expect(found).toEqual(row);
    expect(insertSpy).not.toHaveBeenCalled();
  });

  it("issues a JWT that verifies back to the user's id and email", () => {
    const { db } = makeDb();
    const service = new AuthService(db, jwt);
    const token = service.issueToken(row);
    const claims = service.verifyToken(token);
    expect(claims.sub).toBe(row.id);
    expect(claims.email).toBe(row.email);
  });

  it("rejects a token signed with a different secret", () => {
    const { db } = makeDb();
    const service = new AuthService(db, jwt);
    const foreign = new JwtService({ secret: "other-secret" }).sign({ sub: "x", email: "y" });
    expect(() => service.verifyToken(foreign)).toThrow();
  });
});
