import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from "@nestjs/common";
import type { JobProgressResponse, StartJobResponse } from "@olc/types";
import { CurrentUser } from "../../identity/api/current-user.decorator";
import { JwtAuthGuard } from "../../identity/api/jwt-auth.guard";
import type { User } from "../../identity/domain/user";
import { StartMapsJobUseCase } from "../application/start-maps-job.use-case";
import type { Job } from "../domain/job";
import { JOBS, type Jobs } from "../domain/jobs.port";
import { StartJobDto } from "./start-job.dto";

/** The Job as the SPA polls it — no `userId`, no raw params. */
function toProgress(job: Job): JobProgressResponse {
  return {
    id: job.id,
    status: job.status,
    queriesTotal: job.queriesTotal,
    queriesDone: job.queriesDone,
    leadsFound: job.leadsFound,
    apiCallsUsed: job.apiCallsUsed,
    currentStep: job.currentStep,
    error: job.error,
  };
}

@Controller("jobs")
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(
    private readonly startMapsJob: StartMapsJobUseCase,
    @Inject(JOBS) private readonly jobs: Jobs,
  ) {}

  /**
   * Starts a Job and answers straight away with its id and `queued` status; the
   * work happens in-process afterwards (ADR-0003) and the SPA polls `GET
   * /jobs/:id`.
   *
   * The one-running-Job-per-user rule (a 409) belongs to ticket 09.
   */
  @Post()
  async start(@CurrentUser() user: User, @Body() body: StartJobDto): Promise<StartJobResponse> {
    const job = await this.startMapsJob.execute(user.id, {
      businessType: body.businessType,
      city: body.city,
      state: body.state,
      maxResults: body.maxResults,
    });
    return { id: job.id, status: job.status };
  }

  /**
   * A user may only read their own Jobs. The lookup is scoped by user id in the
   * query, and someone else's Job is a 404 rather than a 403 — a 403 would
   * confirm the id exists. `ParseUUIDPipe` (Nest's own) turns a malformed id
   * into a 400 instead of letting Postgres reject the cast.
   */
  @Get(":id")
  async progress(
    @CurrentUser() user: User,
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<JobProgressResponse> {
    const job = await this.jobs.findByIdForUser(id, user.id);
    if (!job) {
      throw new NotFoundException("job not found");
    }
    return toProgress(job);
  }
}
