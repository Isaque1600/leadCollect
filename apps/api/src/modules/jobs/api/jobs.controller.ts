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
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import type { JobProgressResponse, StartJobResponse } from "@olc/types";
import { CurrentUser } from "../../identity/api/current-user.decorator";
import { JwtAuthGuard } from "../../identity/api/jwt-auth.guard";
import type { User } from "../../identity/domain/user";
import { StartMapsJobUseCase } from "../application/start-maps-job.use-case";
import type { Job } from "../domain/job";
import { JOBS, type Jobs } from "../domain/jobs.port";
import { JobProgressResponseDto, StartJobResponseDto } from "./job-responses.dto";
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

/**
 * With the `@nestjs/swagger` plugin's `introspectComments` on, a route's doc
 * comment becomes its operation in the OpenAPI document: the summary, then
 * `@remarks` as the description. Those comments are written for API callers;
 * notes for maintainers go in `//` comments after them.
 */
@ApiTags("jobs")
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: "Missing, invalid or expired token." })
@Controller("jobs")
@UseGuards(JwtAuthGuard)
export class JobsController {
  constructor(
    private readonly startMapsJob: StartMapsJobUseCase,
    @Inject(JOBS) private readonly jobs: Jobs,
  ) {}

  /**
   * Starts a Maps Job.
   *
   * @remarks Answers straight away with the Job's id and `queued` status. The
   * work runs afterwards; poll `GET /jobs/{id}` for progress.
   */
  // The work runs in-process (ADR-0003). The one-running-Job-per-user rule (a
  // 409) belongs to ticket 09.
  @Post()
  @ApiCreatedResponse({ type: StartJobResponseDto })
  @ApiBadRequestResponse({ description: "The body failed validation." })
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
   * Reads a Job's progress.
   *
   * @remarks Only the caller's own Jobs are visible. Another user's Job is a
   * 404, not a 403, so the answer never confirms that the id exists.
   */
  // The lookup is scoped by user id in the query. `ParseUUIDPipe` (Nest's own)
  // turns a malformed id into a 400 instead of letting Postgres reject the cast.
  // The document cannot see the pipe, so `@ApiParam` states the `uuid` format.
  @Get(":id")
  @ApiParam({ name: "id", format: "uuid", description: "The Job's id." })
  @ApiOkResponse({ type: JobProgressResponseDto })
  @ApiBadRequestResponse({ description: "The id is not a UUID." })
  @ApiNotFoundResponse({ description: "No such Job, or it belongs to another user." })
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
