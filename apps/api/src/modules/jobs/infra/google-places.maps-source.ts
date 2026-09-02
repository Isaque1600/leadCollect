import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigType } from "@nestjs/config";
import { placesConfig } from "../../../shared/config/places.config";
import { sanitizeWebsiteUrl } from "../../leads/domain/lead";
import type { MapsPlaceDetails, MapsSearchHit, MapsSource } from "../domain/maps-source.port";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places";

/**
 * Field masks are mandatory on the Places API (New) and they are what you are
 * billed for — asking for less costs less. These are exactly the fields
 * `collector_maps.py` requested.
 */
const SEARCH_FIELD_MASK = "places.id,places.displayName";
const DETAILS_FIELD_MASK = "id,displayName,nationalPhoneNumber,websiteUri,googleMapsUri";

/** Matches the Python collector's 15s `requests` timeout. */
const REQUEST_TIMEOUT_MS = 15_000;

/** `places:searchText` refuses anything above this. */
const MAX_RESULT_COUNT = 20;

const LANGUAGE_CODE = "pt-BR";

/** The subset of the Places responses we ask for, via the field masks above. */
interface PlacesSearchResponse {
  places?: { id?: string; displayName?: { text?: string } }[];
}

interface PlacesDetailsResponse {
  id?: string;
  displayName?: { text?: string };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
}

/**
 * The Maps Source over Google Places API (New) — the port of
 * `collector_maps.py`'s `buscar_no_maps` and `detalhes_do_lugar` (ADR-0004). The
 * Python script is reference only; nothing shells out to it.
 *
 * Uses the platform `fetch` (Node 22), so there is no HTTP client dependency to
 * carry. The API key comes from `shared/config`, which validated it at boot.
 */
@Injectable()
export class GooglePlacesMapsSource implements MapsSource {
  private readonly logger = new Logger(GooglePlacesMapsSource.name);

  constructor(@Inject(placesConfig.KEY) private readonly config: ConfigType<typeof placesConfig>) {}

  async search(query: string, maxResults: number): Promise<MapsSearchHit[]> {
    const maxResultCount = Math.min(Math.max(Math.trunc(maxResults), 1), MAX_RESULT_COUNT);

    const body = await this.request<PlacesSearchResponse>(SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": this.config.apiKey,
        "X-Goog-FieldMask": SEARCH_FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, languageCode: LANGUAGE_CODE, maxResultCount }),
    });

    return (body.places ?? [])
      .filter((place): place is { id: string; displayName?: { text?: string } } =>
        Boolean(place.id),
      )
      .map((place) => ({ placeId: place.id, name: place.displayName?.text ?? "" }));
  }

  async fetchDetails(placeId: string): Promise<MapsPlaceDetails> {
    const body = await this.request<PlacesDetailsResponse>(
      `${DETAILS_URL}/${encodeURIComponent(placeId)}`,
      {
        method: "GET",
        headers: {
          "X-Goog-Api-Key": this.config.apiKey,
          "X-Goog-FieldMask": DETAILS_FIELD_MASK,
        },
      },
    );

    return {
      placeId: body.id ?? placeId,
      name: body.displayName?.text ?? "",
      phone: body.nationalPhoneNumber ?? null,
      website: sanitizeWebsiteUrl(body.websiteUri),
      sourceUrl: body.googleMapsUri ?? null,
    };
  }

  /**
   * `raise_for_status` plus a timeout, in one place. The response body is
   * included in the message because Places explains quota and field-mask
   * mistakes there, and that text is what ends up on the failed Job's row.
   */
  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      this.logger.warn(`Places API ${response.status} for ${url}: ${detail}`);
      throw new Error(`Places API responded ${response.status}: ${detail}`);
    }

    return (await response.json()) as T;
  }
}
