import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EnrichmentService } from "../../../../src/modules/enrichment/application/enrichment.service";
import type { EnrichmentTarget } from "../../../../src/modules/enrichment/domain/enrichment.port";
import type { WebsiteFetcher } from "../../../../src/modules/enrichment/domain/website-fetcher.port";
import type { Lead } from "../../../../src/modules/leads/domain/lead";
import { FakeLeadPool } from "../../leads/fake-lead-pool";
import { FakeWebsiteFetcher } from "../fake-enrichment";

const SITE = "https://clinica.com.br/";

const PAGE = `
  <a href="mailto:contato@clinica.com.br">e-mail</a>
  <a href="https://wa.me/5583999990000">WhatsApp</a>`;

const now = new Date("2026-03-01T12:00:00Z");

function daysAgo(days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

const PLACES_PHONE = "(83) 3421-0000";

/**
 * Seeds the pool with one Lead and returns the service wired to it, plus the
 * target a Job would hand over: the stored Lead and the phone Places returned
 * in that Job (`PLACES_PHONE` unless the test says otherwise).
 */
function setUp(
  lead: Partial<Lead>,
  fetcher: WebsiteFetcher = new FakeWebsiteFetcher({ [SITE]: PAGE }),
  placesPhone: string | null = PLACES_PHONE,
) {
  const leadPool = new FakeLeadPool();
  const stored: Lead = {
    id: "lead-1",
    placeId: "place-a",
    name: "Clínica Sorriso",
    phone: PLACES_PHONE,
    email: null,
    businessType: "Clínicas odontológicas",
    hasWebsite: true,
    website: SITE,
    sourceUrl: null,
    source: "Google Maps",
    enrichedAt: null,
    createdAt: daysAgo(400),
    updatedAt: daysAgo(400),
    ...lead,
  };
  leadPool.leads.push(stored);

  const target: EnrichmentTarget = { ...stored, placesPhone };

  return { leadPool, target, service: new EnrichmentService(fetcher, leadPool) };
}

/** Lets a floating background promise settle before the test asserts on it. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("EnrichmentService", () => {
  beforeEach(() => {
    // Only `Date` is faked: `setImmediate` has to stay real, because that is how
    // `flush` lets the background re-Enrichment actually run.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enriches a never-enriched Lead before returning, and stamps enrichedAt", async () => {
    const { service, target, leadPool } = setUp({});

    await service.enrichCollectedLead(target);

    expect(leadPool.leads[0]).toMatchObject({
      email: "contato@clinica.com.br",
      // Site WhatsApp beats the phone Places returned.
      phone: "5583999990000",
      enrichedAt: now,
    });
  });

  it("skips a Lead with no website without touching the pool", async () => {
    const fetcher = new FakeWebsiteFetcher();
    const { service, target, leadPool } = setUp({ website: null, hasWebsite: false }, fetcher);

    await service.enrichCollectedLead(target);

    expect(fetcher.requested).toEqual([]);
    expect(leadPool.enrichmentsRecorded).toBe(0);
    expect(leadPool.leads[0]!.enrichedAt).toBeNull();
  });

  it("leaves a Lead enriched inside the last 30 days alone", async () => {
    const fetcher = new FakeWebsiteFetcher({ [SITE]: PAGE });
    const { service, target, leadPool } = setUp({ enrichedAt: daysAgo(29) }, fetcher);

    await service.enrichCollectedLead(target);
    await flush();

    expect(fetcher.requested).toEqual([]);
    expect(leadPool.enrichmentsRecorded).toBe(0);
  });

  it("re-enriches a Stale Lead in the background, without blocking the caller", async () => {
    // The site visit is held open, so "did the caller come back first?" is a
    // real question rather than a race between two already-settled promises.
    let releaseSite: (page: string) => void = () => {};
    const held: WebsiteFetcher = {
      fetchPage: () => new Promise<string | null>((resolve) => (releaseSite = resolve)),
    };
    const { service, target, leadPool } = setUp({ enrichedAt: daysAgo(31) }, held);

    await service.enrichCollectedLead(target);
    // The caller — a running Job — is back while the site is still loading.
    expect(leadPool.enrichmentsRecorded).toBe(0);

    releaseSite(PAGE);
    await flush();

    expect(leadPool.enrichmentsRecorded).toBe(1);
    expect(leadPool.leads[0]).toMatchObject({
      email: "contato@clinica.com.br",
      enrichedAt: now,
    });
  });

  it("stamps enrichedAt even when the site could not be read, so it is not retried every Job", async () => {
    const { service, target, leadPool } = setUp({}, new FakeWebsiteFetcher());

    await service.enrichCollectedLead(target);

    expect(leadPool.leads[0]).toMatchObject({
      email: null,
      // Nothing found on the site: the Places phone stands.
      phone: "(83) 3421-0000",
      enrichedAt: now,
    });
  });

  it("keeps the email it already had when a re-visit finds none", async () => {
    const { service, target, leadPool } = setUp(
      { email: "antigo@clinica.com.br", enrichedAt: daysAgo(31) },
      new FakeWebsiteFetcher({ [SITE]: "<p>sem contato</p>" }),
    );

    await service.enrichCollectedLead(target);
    await flush();

    expect(leadPool.leads[0]!.email).toBe("antigo@clinica.com.br");
  });

  it("re-applies the phone precedence with this Job's Places phone, not the stored one", async () => {
    // The last Enrichment stored the site's WhatsApp; the site has since dropped
    // it. The Places phone must win again rather than the old WhatsApp sticking.
    const { service, target, leadPool } = setUp(
      { phone: "5583999990000", enrichedAt: daysAgo(31) },
      new FakeWebsiteFetcher({ [SITE]: "<p>sem WhatsApp</p>" }),
    );

    await service.enrichCollectedLead(target);
    await flush();

    expect(leadPool.leads[0]!.phone).toBe(PLACES_PHONE);
  });

  it("keeps the stored phone when neither the site nor Places has one", async () => {
    const { service, target, leadPool } = setUp(
      { phone: "5583999990000", enrichedAt: daysAgo(31) },
      new FakeWebsiteFetcher({ [SITE]: "<p>sem contato</p>" }),
      null,
    );

    await service.enrichCollectedLead(target);
    await flush();

    expect(leadPool.leads[0]!.phone).toBe("5583999990000");
  });

  it("swallows a fetcher that throws rather than failing the Job that called it", async () => {
    const exploding: WebsiteFetcher = {
      fetchPage: () => Promise.reject(new Error("ECONNRESET")),
    };
    const { service, target, leadPool } = setUp({}, exploding);

    await expect(service.enrichCollectedLead(target)).resolves.toBeUndefined();
    expect(leadPool.enrichmentsRecorded).toBe(0);
  });
});
