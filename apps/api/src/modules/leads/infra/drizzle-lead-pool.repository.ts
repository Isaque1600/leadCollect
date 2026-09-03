import { Inject, Injectable } from "@nestjs/common";
import type { SourceLabel } from "@olc/types";
import { and, eq, sql } from "drizzle-orm";
import { DB, type Database } from "../../../shared/db/db.module";
import type { CollectedLead, EnrichmentResult, Lead, LeadDraft } from "../domain/lead";
import type { LeadPool } from "../domain/lead-pool.port";
import { leads, userLeads, type LeadRow, type UserLeadRow } from "./leads.schema";

/** The stored row and the domain type share a shape; the mapping stays explicit. */
function toLead(row: LeadRow): Lead {
  return {
    id: row.id,
    placeId: row.placeId,
    name: row.name,
    phone: row.phone,
    email: row.email,
    businessType: row.businessType,
    hasWebsite: row.hasWebsite,
    website: row.website,
    sourceUrl: row.sourceUrl,
    source: row.source as SourceLabel,
    enrichedAt: row.enrichedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toCollectedLead(row: UserLeadRow): CollectedLead {
  return {
    id: row.id,
    userId: row.userId,
    leadId: row.leadId,
    collectedAt: row.collectedAt,
  };
}

/** The Drizzle-backed implementation of the {@link LeadPool} port (ADR-0006/0008). */
@Injectable()
export class DrizzleLeadPoolRepository implements LeadPool {
  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * One statement, not read-then-write: `ON CONFLICT (place_id) DO UPDATE` lets
   * two concurrent Jobs finding the same place settle on a single row instead of
   * racing to insert duplicates.
   *
   * The update deliberately refreshes only what Places just told us. Fields
   * Enrichment owns (`email`, `enriched_at`) are left alone so re-finding a Lead
   * does not wipe them — `phone` is refreshed because Places is its first
   * source, and Enrichment re-applies its precedence right after this upsert.
   */
  async upsertByPlaceId(draft: LeadDraft & { placeId: string }): Promise<Lead> {
    const [row] = await this.db
      .insert(leads)
      .values({
        placeId: draft.placeId,
        name: draft.name,
        phone: draft.phone,
        email: draft.email,
        businessType: draft.businessType,
        hasWebsite: draft.hasWebsite,
        website: draft.website,
        sourceUrl: draft.sourceUrl,
        source: draft.source,
      })
      .onConflictDoUpdate({
        target: leads.placeId,
        set: {
          name: draft.name,
          phone: draft.phone,
          businessType: draft.businessType,
          hasWebsite: draft.hasWebsite,
          website: draft.website,
          sourceUrl: draft.sourceUrl,
          updatedAt: sql`now()`,
        },
      })
      .returning();
    return toLead(row!);
  }

  /**
   * One targeted update rather than a full upsert: Enrichment owns exactly these
   * three columns and must not touch what Places wrote.
   */
  async recordEnrichment(leadId: string, result: EnrichmentResult): Promise<Lead | null> {
    const [row] = await this.db
      .update(leads)
      .set({
        email: result.email,
        phone: result.phone,
        enrichedAt: result.enrichedAt,
        updatedAt: sql`now()`,
      })
      .where(eq(leads.id, leadId))
      .returning();
    return row ? toLead(row) : null;
  }

  async collect(userId: string, leadId: string): Promise<CollectedLead> {
    const [inserted] = await this.db
      .insert(userLeads)
      .values({ userId, leadId })
      .onConflictDoNothing({ target: [userLeads.userId, userLeads.leadId] })
      .returning();
    if (inserted) {
      return toCollectedLead(inserted);
    }

    // Already collected: keep the original `collected_at` rather than moving it.
    const [existing] = await this.db
      .select()
      .from(userLeads)
      .where(and(eq(userLeads.userId, userId), eq(userLeads.leadId, leadId)))
      .limit(1);
    return toCollectedLead(existing!);
  }
}
