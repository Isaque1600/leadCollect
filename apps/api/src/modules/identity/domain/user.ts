/**
 * A person who has signed in with Google. Plain types, no decorators and no
 * imports from `infra/` (ADR-0008): the Drizzle row happens to have the same
 * shape, but the domain does not depend on it.
 *
 * `monthlyQuotaUsed` counts the Billable Calls this user has spent in the
 * current month (CONTEXT.md: Quota). The database owns `id` and `createdAt`.
 */
export interface User {
  id: string;
  googleId: string;
  email: string;
  name: string;
  monthlyQuotaUsed: number;
  createdAt: Date;
}

/**
 * The identity fields taken from a Google `openid email profile` profile —
 * everything sign-in needs and nothing more (ADR-0005).
 */
export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string;
}

/**
 * Whether a stored user's profile has drifted from what Google just told us.
 * A pure rule, so the use-case does not have to spell it out inline.
 */
export function profileHasChanged(user: User, identity: GoogleIdentity): boolean {
  return user.email !== identity.email || user.name !== identity.name;
}
