/** Injection token for the {@link Enrichment} port. */
export const ENRICHMENT = Symbol("Enrichment");

/**
 * What Enrichment needs to know about a Lead to decide what to do with it. A
 * `Lead` from the leads module plus the Source's fresh phone satisfies this
 * structurally, which is how the jobs module hands one over without this
 * `domain/` importing another module's (ADR-0008: `domain/` imports nothing
 * outside itself).
 */
export interface EnrichmentTarget {
  id: string;
  /** The site to visit. `null` — no website — means nothing to enrich. */
  website: string | null;
  /**
   * The phone the Lead carries in the pool right now. Once the Lead has been
   * enriched this is whatever Enrichment picked last time (maybe a site
   * WhatsApp), so it is **not** the Places phone — it is only the fallback
   * when a visit and the Source both come up empty.
   */
  phone: string | null;
  /**
   * The `nationalPhoneNumber` Places returned for this Lead in the Job that
   * just found it — the middle rung of the phone precedence. Passed in fresh
   * rather than read back from `phone`, because after the first Enrichment the
   * stored phone no longer is the Places value. `null` when Places has none.
   */
  placesPhone: string | null;
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
