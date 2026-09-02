import { describe, expect, it, vi } from "vitest";
import type { Profile } from "passport-google-oauth20";
import { GoogleStrategy } from "../../../../src/modules/identity/api/google.strategy";
import type { GoogleIdentity } from "../../../../src/modules/identity/domain/user";

function makeStrategy(): GoogleStrategy {
  return new GoogleStrategy({
    clientId: "client-id",
    clientSecret: "client-secret",
    callbackUrl: "http://localhost:3000/auth/google/callback",
  });
}

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: "g-123",
    displayName: "Lead Hunter",
    emails: [{ value: "lead.hunter@example.com", verified: "true" }],
    ...overrides,
  } as Profile;
}

describe("GoogleStrategy.validate", () => {
  it("maps a Google profile to a GoogleIdentity", () => {
    const done = vi.fn();
    makeStrategy().validate("access", "refresh", profile({}), done);

    expect(done).toHaveBeenCalledWith(null, {
      googleId: "g-123",
      email: "lead.hunter@example.com",
      name: "Lead Hunter",
    } satisfies GoogleIdentity);
  });

  it("falls back to the email when the profile has no display name", () => {
    const done = vi.fn();
    makeStrategy().validate("access", "refresh", profile({ displayName: "" }), done);

    expect(done).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ name: "lead.hunter@example.com" }),
    );
  });

  it("fails when the profile carries no email", () => {
    const done = vi.fn();
    makeStrategy().validate("access", "refresh", profile({ emails: undefined }), done);

    expect(done).toHaveBeenCalledOnce();
    const [error, identity] = done.mock.calls[0]!;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("Google profile has no email");
    expect(identity).toBeUndefined();
  });
});
