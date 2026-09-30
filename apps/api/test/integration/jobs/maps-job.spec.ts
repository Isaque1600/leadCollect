import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";
import { eq } from "drizzle-orm";
import { schema, type Schema } from "../../../src/schema";
import { users } from "../../../src/modules/identity/infra/identity.schema";
import { leads, userLeads } from "../../../src/modules/leads/infra/leads.schema";
import { jobs } from "../../../src/modules/jobs/infra/jobs.schema";
import { DrizzleLeadPoolRepository } from "../../../src/modules/leads/infra/drizzle-lead-pool.repository";
import { DrizzleJobsRepository } from "../../../src/modules/jobs/infra/drizzle-jobs.repository";
import { GooglePlacesMapsSource } from "../../../src/modules/jobs/infra/google-places.maps-source";
import { JobRunner } from "../../../src/modules/jobs/application/job-runner.service";
import { EnrichmentService } from "../../../src/modules/enrichment/application/enrichment.service";
import type { WebsiteFetcher } from "../../../src/modules/enrichment/domain/website-fetcher.port";
import type { JobParams } from "../../../src/modules/jobs/domain/job";

/**
 * A full Job against a real Postgres with only the Places API mocked: the
 * generated migration's constraints (`leads.place_id` unique, `user_leads`
 * unique on `(user_id, lead_id)`) and Drizzle's `ON CONFLICT` upserts are what
 * this covers — the parts a fake repository cannot honestly stand in for.
 *
 * Needs the local Postgres from ticket 15, so it runs under
 * `pnpm --filter @olc/api test:integration` and skips when
 * `DATABASE_URL_TEST` is unset. Point that at a **disposable** database: the
 * tables below are truncated between tests.
 */
const url = process.env.DATABASE_URL_TEST;

const jobParams: JobParams = {
  businessType: "Clínicas odontológicas",
  city: "Patos",
  state: "PB",
  maxResults: 5,
};

/**
 * The company sites Enrichment visits, keyed by URL; an absent URL reads as
 * unreadable. The real `HttpWebsiteFetcher` speaks `node:http` behind an SSRF
 * fence and has its own spec against a loopback server — what this test covers
 * is what Enrichment writes into Postgres, so the web is scripted here.
 */
let sites: Record<string, string> = {};

const scriptedWeb: WebsiteFetcher = {
  fetchPage: async (url) => sites[url] ?? null,
};

/**
 * The responses `fetch` is stubbed with — the Places search and details calls —
 * and the company sites `scriptedWeb` serves for this test.
 */
function stubPlaces(
  searchResults: { id: string; displayName: { text: string } }[],
  details: Record<string, Record<string, unknown>>,
  sitePages: Record<string, string> = {},
) {
  sites = sitePages;
  const fetchMock = vi.fn(async (input: string) => {
    const body = input.includes("places:searchText")
      ? { places: searchResults }
      : (details[decodeURIComponent(input.split("/v1/places/")[1] ?? "")] ?? {});
    return { ok: true, status: 200, json: async () => body, text: async () => "" };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe.skipIf(!url)("Maps Source Job (integration)", () => {
  let client: Sql;
  let db: PostgresJsDatabase<Schema>;
  let jobsRepository: DrizzleJobsRepository;
  let runner: JobRunner;
  let userId: string;

  beforeAll(() => {
    client = postgres(url!, { max: 1 });
    db = drizzle(client, { schema });

    jobsRepository = new DrizzleJobsRepository(db);
    const leadPool = new DrizzleLeadPoolRepository(db);
    const maps = new GooglePlacesMapsSource({ apiKey: "test-places-key" });
    // Real Enrichment and a real Lead Pool; only the web itself is scripted.
    const enrichment = new EnrichmentService(scriptedWeb, leadPool);
    // The runner is driven directly and awaited here; `StartMapsJobUseCase`
    // deliberately does not await it, which a test cannot assert against.
    runner = new JobRunner(jobsRepository, maps, leadPool, enrichment);
  });

  afterAll(async () => {
    await client.end();
  });

  beforeEach(async () => {
    await client`truncate table user_leads, leads, jobs, users restart identity cascade`;
    const [user] = await db
      .insert(users)
      .values({ googleId: "g-integration", email: "hunter@example.com", name: "Lead Hunter" })
      .returning();
    userId = user!.id;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    sites = {};
  });

  it("runs a Job end to end and stores the Leads it collected", async () => {
    stubPlaces(
      [
        { id: "place-a", displayName: { text: "Clínica A" } },
        { id: "place-b", displayName: { text: "Clínica B" } },
      ],
      {
        "place-a": {
          id: "place-a",
          displayName: { text: "Clínica Sorriso" },
          nationalPhoneNumber: "(83) 3421-0000",
          websiteUri: "https://sorriso.com.br/?utm_source=maps",
          googleMapsUri: "https://maps.google.com/?cid=place-a",
        },
        "place-b": { id: "place-b", displayName: { text: "Clínica B" } },
      },
    );

    const started = await jobsRepository.create(userId, jobParams);
    await runner.run(started);

    const [job] = await db.select().from(jobs).where(eq(jobs.id, started.id));
    expect(job!.status).toBe("done");
    expect(job!.queriesTotal).toBe(1);
    expect(job!.queriesDone).toBe(1);
    expect(job!.leadsFound).toBe(2);
    expect(job!.apiCallsUsed).toBe(2);
    expect(job!.error).toBeNull();

    const stored = await db.select().from(leads).orderBy(leads.placeId);
    expect(stored.map((lead) => lead.placeId)).toEqual(["place-a", "place-b"]);
    expect(stored[0]).toMatchObject({
      name: "Clínica Sorriso",
      phone: "(83) 3421-0000",
      website: "https://sorriso.com.br/",
      hasWebsite: true,
      businessType: "Clínicas odontológicas",
      source: "Google Maps",
      email: null,
    });
    expect(stored[1]).toMatchObject({ hasWebsite: false, website: null });

    const collected = await db.select().from(userLeads).where(eq(userLeads.userId, userId));
    expect(collected).toHaveLength(2);
  });

  it("reuses the pooled Lead on a second Job instead of duplicating it", async () => {
    stubPlaces([{ id: "place-a", displayName: { text: "Clínica A" } }], {
      "place-a": { id: "place-a", displayName: { text: "Clínica Sorriso" } },
    });

    await runner.run(await jobsRepository.create(userId, jobParams));
    await runner.run(await jobsRepository.create(userId, jobParams));

    expect(await db.select().from(leads)).toHaveLength(1);
    // The unique (user_id, lead_id) keeps the user's list free of duplicates.
    expect(await db.select().from(userLeads)).toHaveLength(1);
  });

  it("enriches a new Lead from its website during the Job", async () => {
    stubPlaces(
      [{ id: "place-a", displayName: { text: "Clínica A" } }],
      {
        "place-a": {
          id: "place-a",
          displayName: { text: "Clínica Sorriso" },
          nationalPhoneNumber: "(83) 3421-0000",
          websiteUri: "https://sorriso.com.br/",
          googleMapsUri: "https://maps.google.com/?cid=place-a",
        },
      },
      {
        "https://sorriso.com.br/":
          '<a href="mailto:contato@sorriso.com.br">e-mail</a>' +
          '<a href="https://wa.me/5583999990000">WhatsApp</a>',
      },
    );

    const started = await jobsRepository.create(userId, jobParams);
    await runner.run(started);

    const [lead] = await db.select().from(leads);
    expect(lead).toMatchObject({
      email: "contato@sorriso.com.br",
      // Site WhatsApp outranks the nationalPhoneNumber Places returned.
      phone: "5583999990000",
      hasWebsite: true,
    });
    expect(lead!.enrichedAt).toBeInstanceOf(Date);
  });

  it("leaves a Lead with no website unenriched but still stamps nothing on it", async () => {
    stubPlaces([{ id: "place-b", displayName: { text: "Clínica B" } }], {
      "place-b": { id: "place-b", displayName: { text: "Clínica B" } },
    });

    await runner.run(await jobsRepository.create(userId, jobParams));

    const [lead] = await db.select().from(leads);
    expect(lead).toMatchObject({ hasWebsite: false, email: null });
    expect(lead!.enrichedAt).toBeNull();
  });

  it("re-enriches a Stale Lead in the background after the Job has finished", async () => {
    stubPlaces(
      [{ id: "place-a", displayName: { text: "Clínica A" } }],
      {
        "place-a": {
          id: "place-a",
          displayName: { text: "Clínica Sorriso" },
          websiteUri: "https://sorriso.com.br/",
        },
      },
      {
        "https://sorriso.com.br/": '<a href="mailto:novo@sorriso.com.br">e-mail</a>',
      },
    );

    // A Lead already in the pool whose Enrichment is 31 days old.
    const staleAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const [seeded] = await db
      .insert(leads)
      .values({
        placeId: "place-a",
        name: "Clínica Sorriso",
        email: "antigo@sorriso.com.br",
        hasWebsite: true,
        website: "https://sorriso.com.br/",
        source: "Google Maps",
        enrichedAt: staleAt,
      })
      .returning();

    const started = await jobsRepository.create(userId, jobParams);
    await runner.run(started);

    // The Job is done before the re-Enrichment has necessarily landed.
    const [job] = await db.select().from(jobs).where(eq(jobs.id, started.id));
    expect(job!.status).toBe("done");

    await vi.waitFor(async () => {
      const [refreshed] = await db.select().from(leads).where(eq(leads.id, seeded!.id));
      expect(refreshed!.email).toBe("novo@sorriso.com.br");
      expect(refreshed!.enrichedAt!.getTime()).toBeGreaterThan(staleAt.getTime());
    });
  });

  it("re-applies the phone precedence with the fresh Places phone when a Stale Lead is re-enriched", async () => {
    stubPlaces(
      [{ id: "place-a", displayName: { text: "Clínica A" } }],
      {
        "place-a": {
          id: "place-a",
          displayName: { text: "Clínica Sorriso" },
          nationalPhoneNumber: "(83) 3421-0000",
          websiteUri: "https://sorriso.com.br/",
        },
      },
      // The site no longer carries a WhatsApp link.
      { "https://sorriso.com.br/": "<p>Ligue para a recepção</p>" },
    );

    // Its last Enrichment, 31 days ago, stored the site's WhatsApp as the phone.
    const staleAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const [seeded] = await db
      .insert(leads)
      .values({
        placeId: "place-a",
        name: "Clínica Sorriso",
        phone: "5583999990000",
        hasWebsite: true,
        website: "https://sorriso.com.br/",
        source: "Google Maps",
        enrichedAt: staleAt,
      })
      .returning();

    await runner.run(await jobsRepository.create(userId, jobParams));

    await vi.waitFor(async () => {
      const [refreshed] = await db.select().from(leads).where(eq(leads.id, seeded!.id));
      expect(refreshed!.enrichedAt!.getTime()).toBeGreaterThan(staleAt.getTime());
      // No WhatsApp on the site any more, so the Places phone outranks the rest.
      expect(refreshed!.phone).toBe("(83) 3421-0000");
    });
  });

  it("keeps the site WhatsApp when a recently enriched Lead is re-found", async () => {
    stubPlaces(
      [{ id: "place-a", displayName: { text: "Clínica A" } }],
      {
        "place-a": {
          id: "place-a",
          displayName: { text: "Clínica Sorriso" },
          nationalPhoneNumber: "(83) 3421-0000",
          websiteUri: "https://sorriso.com.br/",
        },
      },
      {
        "https://sorriso.com.br/": '<a href="https://wa.me/5583999990000">WhatsApp</a>',
      },
    );

    await runner.run(await jobsRepository.create(userId, jobParams));
    // The second Job re-finds the Lead within 30 days, so it is not re-enriched:
    // the upsert alone must not put the Places phone back over the WhatsApp.
    await runner.run(await jobsRepository.create(userId, jobParams));

    const [lead] = await db.select().from(leads);
    expect(lead!.phone).toBe("5583999990000");
  });

  it("still refreshes the Places phone of a Lead that was never enriched", async () => {
    stubPlaces([{ id: "place-b", displayName: { text: "Clínica B" } }], {
      "place-b": { id: "place-b", displayName: { text: "Clínica B" } },
    });
    await runner.run(await jobsRepository.create(userId, jobParams));

    vi.unstubAllGlobals();
    stubPlaces([{ id: "place-b", displayName: { text: "Clínica B" } }], {
      "place-b": {
        id: "place-b",
        displayName: { text: "Clínica B" },
        nationalPhoneNumber: "(83) 3421-1111",
      },
    });
    await runner.run(await jobsRepository.create(userId, jobParams));

    const [lead] = await db.select().from(leads);
    expect(lead!.phone).toBe("(83) 3421-1111");
  });

  it("records the Places failure on the Job row rather than throwing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        status: 429,
        json: async () => ({}),
        text: async () => "RESOURCE_EXHAUSTED",
      })),
    );

    const started = await jobsRepository.create(userId, jobParams);
    await runner.run(started);

    const [job] = await db.select().from(jobs).where(eq(jobs.id, started.id));
    expect(job!.status).toBe("failed");
    expect(job!.error).toContain("429");
    expect(job!.finishedAt).toBeInstanceOf(Date);
  });
});
