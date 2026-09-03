import type { Job, JobParams } from "../../../src/modules/jobs/domain/job";
import type { JobProgressPatch, Jobs } from "../../../src/modules/jobs/domain/jobs.port";
import type {
  MapsPlaceDetails,
  MapsSearchHit,
  MapsSource,
} from "../../../src/modules/jobs/domain/maps-source.port";

export const USER_ID = "11111111-1111-1111-1111-111111111111";
export const OTHER_USER_ID = "22222222-2222-2222-2222-222222222222";

export const jobParams: JobParams = {
  businessType: "Clínicas odontológicas",
  city: "Patos",
  state: "PB",
  maxResults: 5,
};

/** An in-memory stand-in for the `Jobs` port, mirroring the database defaults. */
export class FakeJobs implements Jobs {
  readonly rows: Job[] = [];
  /** Every patch in order — the progress the SPA would have seen while polling. */
  readonly patches: JobProgressPatch[] = [];

  constructor(seed: Job[] = []) {
    this.rows.push(...seed);
  }

  async create(userId: string, params: JobParams): Promise<Job> {
    const job: Job = {
      id: `job-${this.rows.length + 1}`,
      userId,
      status: "queued",
      params,
      queriesTotal: 0,
      queriesDone: 0,
      leadsFound: 0,
      apiCallsUsed: 0,
      currentStep: null,
      error: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      startedAt: null,
      finishedAt: null,
    };
    this.rows.push(job);
    return job;
  }

  async findByIdForUser(id: string, userId: string): Promise<Job | undefined> {
    return this.rows.find((row) => row.id === id && row.userId === userId);
  }

  async update(id: string, patch: JobProgressPatch): Promise<Job> {
    this.patches.push({ ...patch });
    const index = this.rows.findIndex((row) => row.id === id);
    const updated: Job = { ...this.rows[index]!, ...patch };
    this.rows[index] = updated;
    return updated;
  }

  /** The single Job under test, as it now stands. */
  get only(): Job {
    return this.rows[0]!;
  }
}

/** A scripted Maps Source: no network, and it counts what a Job would be billed. */
export class FakeMapsSource implements MapsSource {
  readonly searchedQueries: string[] = [];
  readonly detailsRequests: string[] = [];

  constructor(
    private readonly hits: MapsSearchHit[],
    private readonly details: Record<string, MapsPlaceDetails> = {},
  ) {}

  async search(query: string, maxResults: number): Promise<MapsSearchHit[]> {
    this.searchedQueries.push(query);
    return this.hits.slice(0, maxResults);
  }

  async fetchDetails(placeId: string): Promise<MapsPlaceDetails> {
    this.detailsRequests.push(placeId);
    return (
      this.details[placeId] ?? {
        placeId,
        name: `Place ${placeId}`,
        phone: "(83) 99999-0000",
        website: "https://exemplo.com.br/",
        sourceUrl: `https://maps.google.com/?cid=${placeId}`,
      }
    );
  }
}
