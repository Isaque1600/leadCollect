import { describe, expect, it } from "vitest";
import { JobRunner } from "../../../../src/modules/jobs/application/job-runner.service";
import type { MapsSource } from "../../../../src/modules/jobs/domain/maps-source.port";
import { FakeEnrichment } from "../../enrichment/fake-enrichment";
import { FakeLeadPool } from "../../leads/fake-lead-pool";
import { FakeJobs, FakeMapsSource, USER_ID, jobParams } from "../fake-jobs";

async function runJob(maps: MapsSource) {
  const jobs = new FakeJobs();
  const leadPool = new FakeLeadPool();
  const enrichment = new FakeEnrichment();
  const job = await jobs.create(USER_ID, jobParams);

  await new JobRunner(jobs, maps, leadPool, enrichment).run(job);

  return { jobs, leadPool, enrichment, job: jobs.only };
}

describe("JobRunner", () => {
  it("moves the Job queued -> running -> done and records the composed query", async () => {
    const maps = new FakeMapsSource([
      { placeId: "place-a", name: "Clínica A" },
      { placeId: "place-b", name: "Clínica B" },
    ]);

    const { jobs, job } = await runJob(maps);

    expect(jobs.patches[0]).toMatchObject({ status: "running", queriesTotal: 1 });
    expect(maps.searchedQueries).toEqual(["Clínicas odontológicas em Patos PB"]);
    expect(job.status).toBe("done");
    expect(job.queriesDone).toBe(1);
    expect(job.currentStep).toBeNull();
    expect(job.error).toBeNull();
    expect(job.startedAt).toBeInstanceOf(Date);
    expect(job.finishedAt).toBeInstanceOf(Date);
  });

  it("upserts each result into the Lead Pool and links it to the requesting user", async () => {
    const maps = new FakeMapsSource([{ placeId: "place-a", name: "Clínica A" }], {
      "place-a": {
        placeId: "place-a",
        name: "Clínica Sorriso",
        phone: "(83) 3421-0000",
        website: "https://sorriso.com.br/",
        sourceUrl: "https://maps.google.com/?cid=place-a",
      },
    });

    const { leadPool, job } = await runJob(maps);

    expect(leadPool.leads).toHaveLength(1);
    expect(leadPool.leads[0]).toMatchObject({
      placeId: "place-a",
      name: "Clínica Sorriso",
      phone: "(83) 3421-0000",
      businessType: "Clínicas odontológicas",
      hasWebsite: true,
      website: "https://sorriso.com.br/",
      sourceUrl: "https://maps.google.com/?cid=place-a",
      source: "Google Maps",
      // No Enrichment yet (ticket 05): a Lead carries only what Places returns.
      email: null,
    });
    expect(leadPool.collected).toEqual([
      expect.objectContaining({ userId: USER_ID, leadId: leadPool.leads[0]!.id }),
    ]);
    expect(job.leadsFound).toBe(1);
  });

  it("marks a place with no website as such", async () => {
    const maps = new FakeMapsSource([{ placeId: "place-a", name: "Clínica A" }], {
      "place-a": {
        placeId: "place-a",
        name: "Clínica A",
        phone: null,
        website: null,
        sourceUrl: null,
      },
    });

    const { leadPool } = await runJob(maps);

    expect(leadPool.leads[0]).toMatchObject({ hasWebsite: false, website: null });
  });

  it("reuses the Lead when the same place_id comes back, instead of duplicating it", async () => {
    const maps = new FakeMapsSource([
      { placeId: "place-a", name: "Clínica A" },
      { placeId: "place-a", name: "Clínica A" },
      { placeId: "place-b", name: "Clínica B" },
    ]);

    const { leadPool, job } = await runJob(maps);

    // Deduped before the details call, so the repeat costs no Billable Call.
    expect(maps.detailsRequests).toEqual(["place-a", "place-b"]);
    expect(leadPool.leads.map((lead) => lead.placeId)).toEqual(["place-a", "place-b"]);
    expect(job.apiCallsUsed).toBe(2);
    expect(job.leadsFound).toBe(2);
  });

  it("keeps one Lead and one Collected Lead when a later Job finds the same place", async () => {
    const leadPool = new FakeLeadPool();
    const maps = new FakeMapsSource([{ placeId: "place-a", name: "Clínica A" }]);
    const jobs = new FakeJobs();

    const first = await jobs.create(USER_ID, jobParams);
    await new JobRunner(jobs, maps, leadPool, new FakeEnrichment()).run(first);
    const second = await jobs.create(USER_ID, jobParams);
    await new JobRunner(jobs, maps, leadPool, new FakeEnrichment()).run(second);

    expect(leadPool.upsertCalls).toBe(2);
    expect(leadPool.leads).toHaveLength(1);
    expect(leadPool.collectCalls).toBe(2);
    expect(leadPool.collected).toHaveLength(1);
  });

  it("counts one Billable Call per details request and none for the text search", async () => {
    const maps = new FakeMapsSource([
      { placeId: "place-a", name: "A" },
      { placeId: "place-b", name: "B" },
      { placeId: "place-c", name: "C" },
    ]);

    const { job } = await runJob(maps);

    expect(job.apiCallsUsed).toBe(3);
  });

  it("asks the Source for no more than the Job's maxResults", async () => {
    const hits = Array.from({ length: 10 }, (_, index) => ({
      placeId: `place-${index}`,
      name: `Place ${index}`,
    }));
    const maps = new FakeMapsSource(hits);
    const jobs = new FakeJobs();
    const job = await jobs.create(USER_ID, { ...jobParams, maxResults: 3 });

    await new JobRunner(jobs, maps, new FakeLeadPool(), new FakeEnrichment()).run(job);

    expect(maps.detailsRequests).toHaveLength(3);
  });

  it("hands every collected Lead to Enrichment", async () => {
    const maps = new FakeMapsSource([{ placeId: "place-a", name: "Clínica A" }], {
      "place-a": {
        placeId: "place-a",
        name: "Clínica Sorriso",
        phone: "(83) 3421-0000",
        website: "https://sorriso.com.br/",
        sourceUrl: null,
      },
    });

    const { enrichment, leadPool } = await runJob(maps);

    expect(enrichment.enriched).toEqual([
      expect.objectContaining({
        id: leadPool.leads[0]!.id,
        website: "https://sorriso.com.br/",
        phone: "(83) 3421-0000",
        enrichedAt: null,
      }),
    ]);
  });

  it("fails the Job with the error text rather than rejecting", async () => {
    const maps: MapsSource = {
      search: () => Promise.reject(new Error("Places API responded 429: quota exceeded")),
      fetchDetails: () => {
        throw new Error("not reached");
      },
    };

    const { job } = await runJob(maps);

    expect(job.status).toBe("failed");
    expect(job.error).toBe("Places API responded 429: quota exceeded");
    expect(job.finishedAt).toBeInstanceOf(Date);
  });

  it("keeps the Leads already collected when the Job fails part-way", async () => {
    let calls = 0;
    const maps: MapsSource = {
      search: async () => [
        { placeId: "place-a", name: "A" },
        { placeId: "place-b", name: "B" },
      ],
      fetchDetails: async (placeId) => {
        calls += 1;
        if (calls > 1) {
          throw new Error("Places API responded 500: internal");
        }
        return { placeId, name: "A", phone: null, website: null, sourceUrl: null };
      },
    };

    const { leadPool, job } = await runJob(maps);

    expect(job.status).toBe("failed");
    expect(leadPool.leads).toHaveLength(1);
    expect(leadPool.collected).toHaveLength(1);
  });
});
