import type { SourceLabel } from "@olc/types";

/**
 * A business found by a Source, stored once in the global Lead Pool and shared
 * by every user (ADR-0002). Plain types, no decorators and no imports from
 * `infra/` (ADR-0008); the database owns `id`, `createdAt` and `updatedAt`.
 *
 * The fields mirror the eight export columns the Python collector produced, in
 * English — only the `source` *value* stays Portuguese, because that is what the
 * `fonte` column of the export shows (CONTEXT.md: Source).
 *
 * `email` is nullable and stays null until Enrichment fills it: a Maps Source
 * Lead carries only what the Places API returns until its website is visited.
 */
export interface Lead {
  id: string;
  /** The Lead Identity for the Maps Source. Null for Leads found some other way. */
  placeId: string | null;
  name: string;
  /** `telefone_whatsapp` in the export. */
  phone: string | null;
  email: string | null;
  /** `tipo_negocio` — the business type the Job searched for. */
  businessType: string | null;
  /** `possui_site` — derived from `website`, stored so the export need not derive it. */
  hasWebsite: boolean;
  website: string | null;
  /** `link_origem` — the Google Maps URL of the place. */
  sourceUrl: string | null;
  /** `fonte`. */
  source: SourceLabel;
  /**
   * When Enrichment last visited this Lead's website. Null means never
   * enriched; more than 30 days ago makes this a Stale Lead (CONTEXT.md).
   */
  enrichedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * What a Source hands the Lead Pool: everything about a Lead except the columns
 * the database owns. Upserting one of these on the Lead Identity is how the pool
 * stays deduplicated.
 */
export type LeadDraft = Omit<Lead, "id" | "createdAt" | "updatedAt" | "enrichedAt">;

/**
 * What Enrichment writes back onto a pooled Lead. `enrichedAt` is stamped even
 * when the visit found nothing, so an unreachable site is not re-visited by
 * every Job for the next 30 days.
 */
export interface EnrichmentResult {
  email: string | null;
  phone: string | null;
  enrichedAt: Date;
}

/**
 * The link between a user and a Lead in the pool — a Collected Lead
 * (CONTEXT.md). A user's list and their export show only these, never the whole
 * pool.
 */
export interface CollectedLead {
  id: string;
  userId: string;
  leadId: string;
  collectedAt: Date;
}

/**
 * Strips the query string and fragment from a website URL, as the Python
 * collector's `sanitizar_url` did — `?utm_source=…` and `#topo` are noise that
 * would otherwise make one site look like several.
 *
 * Anything that is not an http(s) URL is returned untouched, so a malformed
 * `websiteUri` from Places is stored as-is rather than silently dropped.
 */
export function sanitizeWebsiteUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return url;
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return url;
  }
}
