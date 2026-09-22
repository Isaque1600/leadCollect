/**
 * Enrichment (CONTEXT.md): the pattern matching that turns a company website's
 * HTML into email / WhatsApp / phone. A direct port of `collector_maps.py`'s
 * `extrair_contatos_do_site` — same three regexes, same "first match wins", same
 * image-extension guard on the email (ADR-0004: port it, don't reinvent it).
 *
 * Pure functions and plain types, no framework and no I/O (ADR-0008): fetching
 * the page is the fetcher port's job, applying these patterns is this file's.
 */

/** `REGEX_EMAIL` in the Python collector. */
export const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

/** `REGEX_WHATSAPP` — the digits out of a `wa.me` / `api.whatsapp.com` link. */
export const WHATSAPP_PATTERN = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\d{10,13})/;

/** `REGEX_TELEFONE` — a Brazilian number as it is usually written on a page. */
export const PHONE_PATTERN = /(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}/;

/**
 * `EXTENSOES_IGNORAR`: `sprite@2x.png` matches the email pattern but is a file
 * name, so an "email" ending in an image extension is dropped.
 */
const IGNORED_EMAIL_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"];

/** What one visit to a Lead's website yields. Empty strings in Python, null here. */
export interface SiteContacts {
  email: string | null;
  whatsapp: string | null;
  /** `telefone_site`: a phone written on the page, not the one Places knows. */
  sitePhone: string | null;
}

/** What a site that could not be read (robots.txt, timeout, 500) contributes. */
export const NO_CONTACTS: SiteContacts = { email: null, whatsapp: null, sitePhone: null };

/** Applies the three patterns to a page's HTML, exactly as the Python did. */
export function extractContacts(html: string): SiteContacts {
  const email = EMAIL_PATTERN.exec(html)?.[0] ?? null;
  const isImageFile =
    email !== null && IGNORED_EMAIL_EXTENSIONS.some((ext) => email.toLowerCase().endsWith(ext));

  return {
    email: isImageFile ? null : email,
    whatsapp: WHATSAPP_PATTERN.exec(html)?.[1] ?? null,
    sitePhone: PHONE_PATTERN.exec(html)?.[0] ?? null,
  };
}

/**
 * The phone precedence the Python collector settled on, kept intact: the
 * WhatsApp number found on the site beats the `nationalPhoneNumber` Places
 * returned, which beats a loose phone number scraped off the page.
 *
 * `placesPhone` is whatever the Lead carries at the moment Enrichment runs — the
 * Lead Pool upsert refreshes it from Places immediately before, so it really is
 * the Places value and not a leftover from an earlier Enrichment.
 */
export function pickPhone(contacts: SiteContacts, placesPhone: string | null): string | null {
  return contacts.whatsapp ?? placesPhone ?? contacts.sitePhone;
}
