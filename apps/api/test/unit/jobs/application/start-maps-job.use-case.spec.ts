import { describe, expect, it } from "vitest";
import { JobRunner } from "../../../../src/modules/jobs/application/job-runner.service";
import { StartMapsJobUseCase } from "../../../../src/modules/jobs/application/start-maps-job.use-case";
import { FakeEnrichment } from "../../enrichment/fake-enrichment";
import { FakeLeadPool } from "../../leads/fake-lead-pool";
import { FakeJobs, FakeMapsSource, USER_ID, jobParams } from "../fake-jobs";

describe("StartMapsJobUseCase", () => {
  it("persists a queued Job owned by the requesting user and returns it immediately", async () => {
    const jobs = new FakeJobs();
    const runner = new JobRunner(
      jobs,
      new FakeMapsSource([]),
      new FakeLeadPool(),
      new FakeEnrichment(),
    );

    const job = await new StartMapsJobUseCase(jobs, runner).execute(USER_ID, jobParams);

    expect(job.status).toBe("queued");
    expect(job.userId).toBe(USER_ID);
    expect(job.params).toEqual(jobParams);
  });

  it("does not wait for the run: the Job is still queued when execute resolves", async () => {
    const jobs = new FakeJobs();
    // A runner that never settles — if `execute` awaited it, this test would hang.
    const runner = { run: () => new Promise<void>(() => {}) } as unknown as JobRunner;

    const job = await new StartMapsJobUseCase(jobs, runner).execute(USER_ID, jobParams);

    expect(job.status).toBe("queued");
    expect(jobs.patches).toHaveLength(0);
  });

  it("hands the persisted Job to the in-process runner (ADR-0003)", async () => {
    const jobs = new FakeJobs();
    const maps = new FakeMapsSource([{ placeId: "place-a", name: "Clínica A" }]);
    const leadPool = new FakeLeadPool();
    const runner = new JobRunner(jobs, maps, leadPool, new FakeEnrichment());

    await new StartMapsJobUseCase(jobs, runner).execute(USER_ID, jobParams);
    // The run is deliberately not awaited; let the microtask queue drain.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(jobs.only.status).toBe("done");
    expect(leadPool.collected).toHaveLength(1);
  });
});
