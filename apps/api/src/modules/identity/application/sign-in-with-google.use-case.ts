import { Inject, Injectable } from "@nestjs/common";
import { profileHasChanged, type GoogleIdentity, type User } from "../domain/user";
import { USERS, type Users } from "../domain/users.port";

/**
 * Turns a verified Google identity into a user of this app: the first sign-in
 * creates the row, later sign-ins match on `google_id` and refresh the stored
 * email and name if Google's have drifted.
 *
 * Knows the port, not Drizzle — the adapter is wired in `identity.module.ts`.
 */
@Injectable()
export class SignInWithGoogleUseCase {
  constructor(@Inject(USERS) private readonly users: Users) {}

  async execute(identity: GoogleIdentity): Promise<User> {
    const existing = await this.users.findByGoogleId(identity.googleId);
    if (!existing) {
      return this.users.create(identity);
    }
    if (!profileHasChanged(existing, identity)) {
      return existing;
    }
    return this.users.updateProfile(existing.id, identity);
  }
}
