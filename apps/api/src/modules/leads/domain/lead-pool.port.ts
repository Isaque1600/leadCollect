import type { CollectedLead, EnrichmentResult, Lead, LeadDraft } from "./lead";

/** Injection token for the {@link LeadPool} port. */
export const LEAD_POOL = Symbol("LeadPool");

/**
 * How anything reaches the global Lead Pool (ADR-0002). Drizzle has no
 * repository pattern, so the port is declared here in `domain/` and the Drizzle
 * adapter implementing it lives in `infra/` (ADR-0008). Tests substitute a fake.
 */
export interface LeadPool {
  /**
   * Inserts the Lead, or updates the row that already carries this `place_id` —
   * the Lead Identity for the Maps Source. Either way the stored Lead comes
   * back, so a second Job finding the same place reuses it instead of
   * duplicating it.
   */
  upsertByPlaceId(draft: LeadDraft & { placeId: string }): Promise<Lead>;

  /**
   * Records that this user collected this Lead. Collecting the same Lead twice
   * is a no-op rather than an error: the existing Collected Lead is returned.
   */
  collect(userId: string, leadId: string): Promise<CollectedLead>;

  /**
   * Writes what Enrichment found back onto the pooled Lead, in place — the pool
   * is global (ADR-0002), so every user who has this Lead gets the refreshed
   * contact details. `email` and `phone` are Enrichment's to set, which is why
   * `upsertByPlaceId` deliberately leaves `email` alone.
   *
   * Returns the updated Lead, or null if the row is gone.
   */
  recordEnrichment(leadId: string, result: EnrichmentResult): Promise<Lead | null>;
}
