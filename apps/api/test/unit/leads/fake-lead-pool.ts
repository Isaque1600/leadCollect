import type {
  CollectedLead,
  EnrichmentResult,
  Lead,
  LeadDraft,
} from "../../../src/modules/leads/domain/lead";
import type { LeadPool } from "../../../src/modules/leads/domain/lead-pool.port";

/**
 * An in-memory stand-in for the `LeadPool` port, reproducing exactly the two
 * constraints the migration declares: `leads.place_id` is unique, and
 * `user_leads` is unique on `(user_id, lead_id)`. The port is ours (ADR-0008),
 * so a fake is honest and needs no Postgres; the SQL upsert itself is what the
 * integration test covers.
 */
export class FakeLeadPool implements LeadPool {
  readonly leads: Lead[] = [];
  readonly collected: CollectedLead[] = [];
  upsertCalls = 0;
  collectCalls = 0;
  enrichmentsRecorded = 0;

  async upsertByPlaceId(draft: LeadDraft & { placeId: string }): Promise<Lead> {
    this.upsertCalls += 1;
    const index = this.leads.findIndex((lead) => lead.placeId === draft.placeId);

    if (index >= 0) {
      // ON CONFLICT DO UPDATE: same row, refreshed — never a second Lead.
      const updated: Lead = {
        ...this.leads[index]!,
        ...draft,
        // Enrichment owns these two; the upsert leaves them where they were.
        email: this.leads[index]!.email,
        enrichedAt: this.leads[index]!.enrichedAt,
        updatedAt: new Date("2026-02-01T00:00:00Z"),
      };
      this.leads[index] = updated;
      return updated;
    }

    const created: Lead = {
      id: `lead-${this.leads.length + 1}`,
      ...draft,
      enrichedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    this.leads.push(created);
    return created;
  }

  async recordEnrichment(leadId: string, result: EnrichmentResult): Promise<Lead | null> {
    this.enrichmentsRecorded += 1;
    const index = this.leads.findIndex((lead) => lead.id === leadId);
    if (index < 0) {
      return null;
    }
    const updated: Lead = { ...this.leads[index]!, ...result };
    this.leads[index] = updated;
    return updated;
  }

  async collect(userId: string, leadId: string): Promise<CollectedLead> {
    this.collectCalls += 1;
    const existing = this.collected.find(
      (link) => link.userId === userId && link.leadId === leadId,
    );
    if (existing) {
      return existing;
    }

    const link: CollectedLead = {
      id: `user-lead-${this.collected.length + 1}`,
      userId,
      leadId,
      collectedAt: new Date("2026-01-01T00:00:00Z"),
    };
    this.collected.push(link);
    return link;
  }
}
