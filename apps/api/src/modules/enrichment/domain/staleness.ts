/**
 * A Stale Lead (CONTEXT.md) is a Lead whose Enrichment is more than 30 days old.
 * When a Job's search touches one, it is re-enriched in the background.
 */

/** 30 days, the age at which an Enrichment stops being trusted. */
export const STALE_AFTER_DAYS = 30;

const STALE_AFTER_MS = STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;

/**
 * Has this Lead never been enriched? Those are enriched inline during the Job
 * that found them, not in the background — the user is waiting for the contact
 * details of a Lead they just collected.
 */
export function isNeverEnriched(enrichedAt: Date | null): boolean {
  return enrichedAt === null;
}

/**
 * Is this a Stale Lead? Exactly 30 days old is *not* stale — staleness starts
 * strictly beyond the boundary, matching "more than 30 days old". A Lead that
 * was never enriched is not stale either; it is unenriched, which
 * {@link isNeverEnriched} answers.
 */
export function isStale(enrichedAt: Date | null, now: Date = new Date()): boolean {
  if (enrichedAt === null) {
    return false;
  }
  return now.getTime() - enrichedAt.getTime() > STALE_AFTER_MS;
}
