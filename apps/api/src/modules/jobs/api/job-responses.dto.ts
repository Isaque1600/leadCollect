import type { JobProgressResponse, JobStatus, StartJobResponse } from "@olc/types";

/**
 * The Jobs routes' response bodies as classes, so the `@nestjs/swagger` CLI
 * plugin can read their shape at `nest build`. It cannot read interfaces.
 * `@olc/types` stays the contract, and `implements` keeps these classes in step
 * with it. No decorators are needed: the plugin infers every property,
 * including `JobStatus`'s values as an enum and `string | null` as nullable.
 */
export class StartJobResponseDto implements StartJobResponse {
  id!: string;
  status!: JobStatus;
}

export class JobProgressResponseDto implements JobProgressResponse {
  id!: string;
  status!: JobStatus;
  queriesTotal!: number;
  queriesDone!: number;
  leadsFound!: number;
  /** Billable Calls spent so far (CONTEXT.md). */
  apiCallsUsed!: number;
  currentStep!: string | null;
  error!: string | null;
}
