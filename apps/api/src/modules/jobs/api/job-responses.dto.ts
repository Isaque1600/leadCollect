import type { JobProgressResponse, JobStatus, StartJobResponse } from "@olc/types";

/**
 * The Jobs routes' response bodies as classes, so the `@nestjs/swagger` CLI
 * plugin can read their shape at `nest build`. It cannot read interfaces.
 * `@olc/types` stays the contract, and `implements` keeps these classes in step
 * with it. No decorators are needed: the plugin infers every property,
 * including `JobStatus`'s values as an enum and `string | null` as nullable.
 *
 * The plugin's `introspectComments` turns each property's doc comment into its
 * description in the OpenAPI document, so those comments are written for API
 * callers.
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
  /** Billable Calls this Job has spent so far. */
  // "Billable Call" is a CONTEXT.md term.
  apiCallsUsed!: number;
  currentStep!: string | null;
  error!: string | null;
}
