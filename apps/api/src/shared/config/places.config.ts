import { registerAs } from "@nestjs/config";

/**
 * The Google Places API (New) key the Maps Source spends Billable Calls with —
 * `API_KEY` in the Python collector's `.env`, renamed because this app will
 * carry a second Source's key too (ticket 06, Brave).
 *
 * A separate key from the OAuth client in `google.config.ts`: that one is an
 * identity credential, this one is billed per request.
 */
export const placesConfig = registerAs("places", () => ({
  apiKey: process.env.GOOGLE_PLACES_API_KEY as string,
}));
