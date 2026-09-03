import type { Job, JobParams, JobStatus } from "./job";

/** Injection token for the {@link Jobs} port. */
export const JOBS = Symbol("Jobs");

/** The progress counters the runner writes back as it works. */
export interface JobProgressPatch {
  status?: JobStatus;
  queriesTotal?: number;
  queriesDone?: number;
  leadsFound?: number;
  apiCallsUsed?: number;
  currentStep?: string | null;
  error?: string | null;
  startedAt?: Date;
  finishedAt?: Date;
}

/**
 * How the jobs module reaches its stored Jobs. Drizzle has no repository
 * pattern, so the port is declared here in `domain/` and the Drizzle adapter
 * implementing it lives in `infra/` (ADR-0008). Tests substitute a fake.
 */
export interface Jobs {
  /** Inserts a `queued` Job; the database generates `id` and `createdAt`. */
  create(userId: string, params: JobParams): Promise<Job>;

  /**
   * Scoped by user on purpose: a user may only read their own Jobs, and the
   * scoping belongs in the query rather than in a check the caller might skip.
   */
  findByIdForUser(id: string, userId: string): Promise<Job | undefined>;

  /** Writes the progress the SPA polls. Returns the Job as stored. */
  update(id: string, patch: JobProgressPatch): Promise<Job>;
}
