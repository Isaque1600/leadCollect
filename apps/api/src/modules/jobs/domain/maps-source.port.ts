/** Injection token for the {@link MapsSource} port. */
export const MAPS_SOURCE = Symbol("MapsSource");

/** One hit from a text search: enough to decide whether details are worth buying. */
export interface MapsSearchHit {
  /** The Google `place_id` — the Lead Identity for this Source (CONTEXT.md). */
  placeId: string;
  name: string;
}

/** What a details request returns, before it is mapped into a Lead. */
export interface MapsPlaceDetails {
  placeId: string;
  name: string;
  /** `nationalPhoneNumber` from Places, if the place has one. */
  phone: string | null;
  /** `websiteUri`, already stripped of query string and fragment. */
  website: string | null;
  /** `googleMapsUri` — what the export calls `link_origem`. */
  sourceUrl: string | null;
}

/**
 * The Maps Source (CONTEXT.md): Google Places, in the two steps the Python
 * collector used. Splitting search from details is not an implementation
 * detail — a text search is one request no matter how many places come back,
 * while **each** details request is a Billable Call. Keeping them apart is what
 * lets ticket 07 answer from the Lead Pool without buying details.
 */
export interface MapsSource {
  /** `places:searchText`. One request; returns at most `maxResults` hits. */
  search(query: string, maxResults: number): Promise<MapsSearchHit[]>;

  /** `places/{place_id}`. One Billable Call per invocation. */
  fetchDetails(placeId: string): Promise<MapsPlaceDetails>;
}
