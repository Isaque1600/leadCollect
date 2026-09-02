import { JwtService } from "@nestjs/jwt";
import { describe, expect, it } from "vitest";
import { TokensService } from "../../../../src/modules/identity/application/tokens.service";
import { storedUser } from "../fake-users";

function makeTokens(secret = "test-secret-that-is-long-enough") {
  return new TokensService(new JwtService({ secret, signOptions: { expiresIn: "1h" } }));
}

describe("TokensService", () => {
  it("issues a token that verifies back to the user's id and email", () => {
    const tokens = makeTokens();
    const claims = tokens.verify(tokens.issue(storedUser));

    expect(claims.sub).toBe(storedUser.id);
    expect(claims.email).toBe(storedUser.email);
  });

  it("rejects a token signed with a different secret", () => {
    const foreign = makeTokens("another-secret-entirely").issue(storedUser);

    expect(() => makeTokens().verify(foreign)).toThrow();
  });

  it("rejects an expired token", () => {
    const jwt = new JwtService({ secret: "test-secret-that-is-long-enough" });
    const expired = jwt.sign({ sub: storedUser.id, email: storedUser.email }, { expiresIn: "-1s" });

    expect(() => makeTokens().verify(expired)).toThrow();
  });
});
