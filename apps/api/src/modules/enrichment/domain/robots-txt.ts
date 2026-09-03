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
