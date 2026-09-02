import { describe, expect, it } from "vitest";
import { SignInWithGoogleUseCase } from "../../../../src/modules/identity/application/sign-in-with-google.use-case";
import { FakeUsers, googleIdentity, storedUser } from "../fake-users";

describe("SignInWithGoogleUseCase", () => {
  it("creates a users row on the first sign-in", async () => {
    const users = new FakeUsers();
    const created = await new SignInWithGoogleUseCase(users).execute(googleIdentity);

    expect(users.createCalls).toBe(1);
    expect(created.googleId).toBe(googleIdentity.googleId);
    expect(created.email).toBe(googleIdentity.email);
    expect(created.monthlyQuotaUsed).toBe(0);
  });

  it("matches on google_id for a returning user and does not create", async () => {
    const users = new FakeUsers([storedUser]);
    const found = await new SignInWithGoogleUseCase(users).execute(googleIdentity);

    expect(found).toEqual(storedUser);
    expect(users.createCalls).toBe(0);
    expect(users.updateProfileCalls).toBe(0);
  });

  it("refreshes the stored email and name when Google's have changed", async () => {
    const users = new FakeUsers([storedUser]);
    const updated = await new SignInWithGoogleUseCase(users).execute({
      ...googleIdentity,
      email: "renamed@example.com",
      name: "Renamed Hunter",
    });

    expect(users.createCalls).toBe(0);
    expect(users.updateProfileCalls).toBe(1);
    expect(updated.id).toBe(storedUser.id);
    expect(updated.email).toBe("renamed@example.com");
    expect(updated.name).toBe("Renamed Hunter");
    // The Quota the user has already spent survives a profile refresh.
    expect(updated.monthlyQuotaUsed).toBe(storedUser.monthlyQuotaUsed);
  });
});
