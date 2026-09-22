/** Injection token for the {@link Enrichment} port. */
export const ENRICHMENT = Symbol("Enrichment");

/**
 * What Enrichment needs to know about a Lead to decide what to do with it. A
 * `Lead` from the leads module satisfies this structurally, which is how the
 * jobs module hands one over without this `domain/` importing another module's
 * (ADR-0008: `domain/` imports nothing outside itself).
 */
export interface EnrichmentTarget {
  id: string;
  /** The site to visit. `null` — no website — means nothing to enrich. */
  website: string | null;
  /** What the Lead carries now; the phone precedence needs the Places value. */
  phone: string | null;
  email: string | null;
  /** `null` when this Lead has never been enriched. */
  enrichedAt: Date | null;
}

/**
 * Enrichment (CONTEXT.md): visiting a Lead's website to extract email, WhatsApp
 * and phone. The jobs module reaches it only through this port.
 */
export interface Enrichment {
  /**
   * Called for every Lead a Job collects. Decides between enriching it now,
   * refreshing a Stale Lead in the background, and doing nothing — see the
   * implementation for the policy.
   */
  enrichCollectedLead(target: EnrichmentTarget): Promise<void>;
}
