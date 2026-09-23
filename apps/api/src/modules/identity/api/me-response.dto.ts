import type { MeResponse } from "@olc/types";

/**
 * `GET /me`'s body as a class, so the `@nestjs/swagger` CLI plugin can read its
 * shape at `nest build`. It cannot read interfaces. `@olc/types` stays the
 * contract, and `implements` keeps this class in step with it.
 */
export class MeResponseDto implements MeResponse {
  id!: string;
  email!: string;
  name!: string;
  /** Billable Calls spent this month (CONTEXT.md: Quota). */
  monthlyQuotaUsed!: number;
}
