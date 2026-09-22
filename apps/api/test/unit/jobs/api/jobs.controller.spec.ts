import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { JobsController } from "../../../../src/modules/jobs/api/jobs.controller";
import type { StartJobDto } from "../../../../src/modules/jobs/api/start-job.dto";
import { JobRunner } from "../../../../src/modules/jobs/application/job-runner.service";
import { StartMapsJobUseCase } from "../../../../src/modules/jobs/application/start-maps-job.use-case";
import type { User } from "../../../../src/modules/identity/domain/user";
import { storedUser } from "../../identity/fake-users";
import { FakeEnrichment } from "../../enrichment/fake-enrichment";
import { FakeLeadPool } from "../../leads/fake-lead-pool";
import { FakeJobs, FakeMapsSource, OTHER_USER_ID, jobParams } from "../fake-jobs";

const body: StartJobDto = { ...jobParams };

const otherUser: User = { ...storedUser, id: OTHER_USER_ID, googleId: "g-999" };

/**
 * The runner is wired with a Source that finds nothing, so starting a Job in
 * these tests does no collecting; the reading tests seed the store directly
 * rather than racing the (deliberately un-awaited) run.
 */
function makeController(jobs = new FakeJobs()) {
  const runner = new JobRunner(
    jobs,
    new FakeMapsSource([]),
    new FakeLeadPool(),
    new FakeEnrichment(),
  );
  return { jobs, controller: new JobsController(new StartMapsJobUseCase(jobs, runner), jobs) };
}

describe("JobsController", () => {
  it("POST /jobs answers with the new Job's id and queued status", async () => {
    const { controller } = makeController();

    const response = await controller.start(storedUser, body);

    expect(response.status).toBe("queued");
    expect(response.id).toBeTruthy();
  });

  it("POST /jobs stores the Job against the signed-in user, not the body", async () => {
    const { controller, jobs } = makeController();

    await controller.start(storedUser, body);

    expect(jobs.only.userId).toBe(storedUser.id);
    expect(jobs.only.params).toEqual(jobParams);
  });

  it("GET /jobs/:id returns the progress payload the SPA polls", async () => {
    const jobs = new FakeJobs();
    const { controller } = makeController(jobs);
    const { id } = await jobs.create(storedUser.id, jobParams);
    await jobs.update(id, {
      status: "running",
      queriesTotal: 1,
      queriesDone: 0,
      leadsFound: 4,
      apiCallsUsed: 4,
      currentStep: "Coletando: Clínica A",
    });

    await expect(controller.progress(storedUser, id)).resolves.toEqual({
      id,
      status: "running",
      queriesTotal: 1,
      queriesDone: 0,
      leadsFound: 4,
      apiCallsUsed: 4,
      currentStep: "Coletando: Clínica A",
      error: null,
    });
  });

  it("does not leak the owner or the raw params in the progress payload", async () => {
    const jobs = new FakeJobs();
    const { controller } = makeController(jobs);
    const { id } = await jobs.create(storedUser.id, jobParams);

    const progress = await controller.progress(storedUser, id);

    expect(progress).not.toHaveProperty("userId");
    expect(progress).not.toHaveProperty("params");
  });

  it("404s on another user's Job rather than 403, so ids cannot be probed", async () => {
    const jobs = new FakeJobs();
    const { controller } = makeController(jobs);
    const { id } = await jobs.create(storedUser.id, jobParams);

    await expect(controller.progress(otherUser, id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("404s on a Job that does not exist", async () => {
    const { controller } = makeController();

    await expect(
      controller.progress(storedUser, "33333333-3333-3333-3333-333333333333"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
