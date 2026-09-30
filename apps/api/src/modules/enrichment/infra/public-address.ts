import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { BlockList, isIP, type LookupFunction } from "node:net";

/**
 * Which IP addresses Enrichment may connect to: public unicast only. Every URL
 * it visits comes from outside — a `websiteUri` from Places today, arbitrary
 * web search results from ticket 06 on — so without this a Lead whose "website"
 * is `http://169.254.169.254/` or `http://localhost:5432/` would turn the API
 * into a proxy onto its own host and network (SSRF).
 *
 * Built on the platform's `net.BlockList`, which also matches IPv4-mapped IPv6
 * addresses (`::ffff:127.0.0.1`) against the IPv4 ranges below.
 */
const NON_PUBLIC = new BlockList();

for (const [network, prefix] of [
  ["0.0.0.0", 8], // "this network", incl. the unspecified 0.0.0.0
  ["10.0.0.0", 8], // private
  ["100.64.0.0", 10], // CGNAT (also Alibaba's metadata endpoint, 100.100.100.200)
  ["127.0.0.0", 8], // loopback
  ["169.254.0.0", 16], // link-local (AWS/GCP/Azure metadata, 169.254.169.254)
  ["172.16.0.0", 12], // private
  ["192.0.0.0", 24], // IETF protocol assignments
  ["192.0.2.0", 24], // documentation
  ["192.168.0.0", 16], // private
  ["198.18.0.0", 15], // benchmarking
  ["198.51.100.0", 24], // documentation
  ["203.0.113.0", 24], // documentation
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved, incl. broadcast 255.255.255.255
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv4");
}

for (const [network, prefix] of [
  ["::", 96], // unspecified ::, loopback ::1, and deprecated IPv4-compatible
  ["64:ff9b::", 96], // NAT64 — would reach an IPv4 address, possibly a private one
  ["64:ff9b:1::", 48], // local-use NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["fc00::", 7], // unique local (incl. AWS's IPv6 metadata, fd00:ec2::254)
  ["fe80::", 10], // link-local
  ["fec0::", 10], // deprecated site-local
  ["ff00::", 8], // multicast
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv6");
}

/** Is this a public unicast address Enrichment may connect to? Unparseable → no. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 0) {
    return false;
  }
  return !NON_PUBLIC.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * A `lookup` for `http.request` that refuses to hand back an address the
 * policy rejects. Checking at this point — the address the socket is about to
 * connect to, not the hostname and not a separate earlier resolution — is what
 * makes the guard hold against DNS rebinding: there is no second lookup for an
 * attacker's DNS to answer differently.
 *
 * If *any* address a name resolves to is refused, the whole lookup fails,
 * rather than quietly connecting to the others.
 *
 * Node calls `lookup` with `all: true` when it races IPv4 and IPv6
 * (`autoSelectFamily`, on by default since Node 20) and without it otherwise;
 * both callback shapes are answered.
 */
export function guardedLookup(
  isAllowed: (address: string) => boolean,
  lookup: LookupFunction = dnsLookup as LookupFunction,
): LookupFunction {
  return (hostname, options, callback) => {
    lookup(hostname, { ...options, all: true }, (error, resolved) => {
      if (error) {
        callback(error, "");
        return;
      }
      const addresses: LookupAddress[] = Array.isArray(resolved)
        ? resolved
        : [{ address: resolved, family: isIP(resolved) }];

      const refused = addresses.find((entry) => !isAllowed(entry.address));
      if (refused !== undefined || addresses.length === 0) {
        const reason = refused ? `non-public address ${refused.address}` : "no address";
        callback(new NonPublicAddressError(`${hostname} resolves to ${reason}`), "");
        return;
      }

      if (options.all) {
        callback(null, addresses);
      } else {
        callback(null, addresses[0]!.address, addresses[0]!.family);
      }
    });
  };
}

/** Raised when a URL would take Enrichment somewhere it must not go. */
export class NonPublicAddressError extends Error {
  readonly code = "ENONPUBLIC";

  constructor(message: string) {
    super(message);
    this.name = "NonPublicAddressError";
  }
}
