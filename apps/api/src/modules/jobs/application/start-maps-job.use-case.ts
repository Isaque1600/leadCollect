import { Inject, Injectable } from "@nestjs/common";
import type { Job, JobParams } from "../domain/job";
import { JOBS, type Jobs } from "../domain/jobs.port";
import { JobRunner } from "./job-runner.service";

/**
 * Starts a Job: persists it as `queued`, hands it to the in-process runner, and
 * returns immediately so `POST /jobs` answers with an id the SPA can poll
 * (ADR-0003).
 *
 * The run is deliberately *not* awaited. `JobRunner.run` never rejects — it
 * records a failure on the Job row — so the floating promise cannot take the
 * request or the process down. That is the whole of the "queue": a method call.
 * Nest's own scheduling packages (`@nestjs/schedule`, `@nestjs/bullmq`) buy
 * nothing here; ADR-0003 rejected a broker on purpose, and ticket 09's reaper is
 * where `@nestjs/schedule` will actually earn its place.
 */
@Injectable()
export class StartMapsJobUseCase {
  constructor(
    @Inject(JOBS) private readonly jobs: Jobs,
    private readonly runner: JobRunner,
  ) {}

  async execute(userId: string, params: JobParams): Promise<Job> {
    const job = await this.jobs.create(userId, params);
    void this.runner.run(job);
    return job;
  }
}
