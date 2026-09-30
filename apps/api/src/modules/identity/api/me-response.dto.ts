import type { MeResponse } from "@olc/types";

/**
 * `GET /me`'s body as a class, so the `@nestjs/swagger` CLI plugin can read its
 * shape at `nest build`. It cannot read interfaces. `@olc/types` stays the
 * contract, and `implements` keeps this class in step with it.
 *
 * The plugin's `introspectComments` turns each property's doc comment into its
 * description in the OpenAPI document, so those comments are written for API
 * callers.
 */
export class MeResponseDto implements MeResponse {
  id!: string;
  email!: string;
  name!: string;
  /** Billable Calls the user has spent this month. */
  // "Billable Call" and "Quota" are CONTEXT.md terms.
  monthlyQuotaUsed!: number;
}
