/**
 * The `robots.txt` check Enrichment owes every site it visits (CONTEXT.md), and
 * the one part of `collector_maps.py` that had no direct JavaScript equivalent:
 * Python got `urllib.robotparser.RobotFileParser` from its standard library,
 * Node has nothing of the sort.
 *
 * So this is a deliberately small port of *that parser's* semantics rather than
 * a general robots.txt engine: group the file by `User-agent`, take the group
 * for our agent or else the `*` group, and let the **first** matching rule
 * decide by simple path prefix. `Allow`/`Disallow` wildcards (`*`, `$`),
 * `Crawl-delay` and `Sitemap` are ignored, exactly as CPython's parser ignores
 * them — a site that only expresses its wishes with wildcards is treated as
 * permissive here, which is the same answer the Python collector gave.
 *
 * Pure: parsing is here in `domain/`, fetching the file is `infra/`'s job.
 */

interface RobotsRule {
  allow: boolean;
  path: string;
}

/** A parsed `robots.txt`, or the permissive default when there is nothing to parse. */
export interface RobotsRules {
  /** The rules of the group that applies to us, in file order. */
  rules: RobotsRule[];
}

/** No file, an unreadable file, or a file with no group for us: everything is allowed. */
export const ALLOW_EVERYTHING: RobotsRules = { rules: [] };

/** A `robots.txt` behind a 401/403: the site is keeping us out entirely. */
export const DISALLOW_EVERYTHING: RobotsRules = { rules: [{ allow: false, path: "/" }] };

/**
 * The rules a `robots.txt` response amounts to, by status first, as CPython's
 * `RobotFileParser.read` decides it:
 *
 * - `401`/`403` → disallow everything: an access-controlled `robots.txt` means
 *   the whole site is;
 * - any other `4xx` (no file) → allow everything;
 * - a success → parse the body.
 *
 * `null` — the request never produced a response (timeout, DNS, refused
 * address, oversized body) — is allowed: `urlopen` raises for those, and
 * `pode_acessar`'s `except: return True` turned that into permission.
 *
 * A `5xx` is allowed too, which is **not** what CPython does: it sets neither
 * flag, never parses, and `can_fetch` then answers False. Kept permissive for
 * now as the ticket 05 port had it; see the ticket's notes.
 */
export function robotsRulesFor(
  status: number | null,
  body: string | null,
  userAgent: string,
): RobotsRules {
  if (status === 401 || status === 403) {
    return DISALLOW_EVERYTHING;
  }
  if (status === null || body === null || status < 200 || status >= 300) {
    return ALLOW_EVERYTHING;
  }
  return parseRobotsTxt(body, userAgent);
}

/**
 * Parses `robots.txt` into the rule group that applies to `userAgent`. A group
 * naming our agent wins over the `*` group; if neither exists, nothing is
 * disallowed.
 */
export function parseRobotsTxt(content: string, userAgent: string): RobotsRules {
  const agent = userAgent.toLowerCase();

  const wildcard: RobotsRule[] = [];
  const specific: RobotsRule[] = [];
  // Which of the two above the current `User-agent:` group writes into, and
  // whether the previous line was also a `User-agent:` (consecutive agent lines
  // share one group of rules, as in CPython's parser).
  let targets: RobotsRule[][] = [];
  let inAgentBlock = false;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.split("#")[0]!.trim();
    if (line === "") {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator < 0) {
      continue;
    }
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (field === "user-agent") {
      if (!inAgentBlock) {
        targets = [];
        inAgentBlock = true;
      }
      const declared = value.toLowerCase();
      if (declared === "*") {
        targets.push(wildcard);
      } else if (agent.includes(declared)) {
        targets.push(specific);
      }
      continue;
    }

    inAgentBlock = false;
    if (field !== "allow" && field !== "disallow") {
      continue;
    }
    // `Disallow:` with an empty value means "nothing is disallowed" — CPython
    // turns it into an allow rule that matches every path.
    const allow = field === "allow" || value === "";
    for (const target of targets) {
      target.push({ allow, path: value });
    }
  }

  const rules = specific.length > 0 ? specific : wildcard;
  return { rules };
}

/**
 * May we fetch this URL? First matching rule wins, and an unmatched URL is
 * allowed — the same fail-open stance `pode_acessar` took, where any trouble at
 * all returned `True`.
 */
export function isAllowed(robots: RobotsRules, url: string): boolean {
  let path: string;
  try {
    const parsed = new URL(url);
    path = `${parsed.pathname}${parsed.search}`;
  } catch {
    return true;
  }

  for (const rule of robots.rules) {
    if (rule.path === "*" || path.startsWith(rule.path)) {
      return rule.allow;
    }
  }
  return true;
}

/** `https://host/robots.txt` for a page URL, or null if the URL is unusable. */
export function robotsTxtUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}/robots.txt`;
  } catch {
    return null;
  }
}
