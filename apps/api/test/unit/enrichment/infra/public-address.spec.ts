import type { LookupFunction } from "node:net";
import { describe, expect, it } from "vitest";
import {
  guardedLookup,
  isPublicAddress,
} from "../../../../src/modules/enrichment/infra/public-address";

describe("isPublicAddress", () => {
  it.each([
    "8.8.8.8",
    "200.147.67.142",
    "172.32.0.1", // just past 172.16.0.0/12
    "100.128.0.1", // just past CGNAT
    "2606:4700:4700::1111",
    "::ffff:8.8.8.8",
  ])("allows public %s", (address) => {
    expect(isPublicAddress(address)).toBe(true);
  });

  it.each([
    ["unspecified", "0.0.0.0"],
    ["loopback", "127.0.0.1"],
    ["loopback", "127.255.255.254"],
    ["private 10/8", "10.1.2.3"],
    ["private 172.16/12", "172.31.255.255"],
    ["private 192.168/16", "192.168.0.1"],
    ["link-local / cloud metadata", "169.254.169.254"],
    ["CGNAT / Alibaba metadata", "100.100.100.200"],
    ["multicast", "224.0.0.1"],
    ["broadcast", "255.255.255.255"],
    ["IPv6 unspecified", "::"],
    ["IPv6 loopback", "::1"],
    ["IPv6 link-local", "fe80::1"],
    ["IPv6 unique local / AWS metadata", "fd00:ec2::254"],
    ["IPv4-mapped loopback", "::ffff:127.0.0.1"],
    ["IPv4-mapped loopback, hex form", "::ffff:7f00:1"],
    ["IPv4-mapped metadata", "::ffff:169.254.169.254"],
    ["IPv4-mapped private", "::ffff:10.0.0.1"],
    ["NAT64", "64:ff9b::7f00:1"],
    ["not an address", "localhost"],
  ])("refuses %s (%s)", (_label, address) => {
    expect(isPublicAddress(address)).toBe(false);
  });
});

describe("guardedLookup", () => {
  function resolvingTo(...addresses: string[]): LookupFunction {
    return (_hostname, _options, callback) =>
      callback(
        null,
        addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })),
      );
  }

  function run(lookup: LookupFunction, all: boolean) {
    return new Promise<{ error: Error | null; address: unknown; family?: number }>((resolve) =>
      lookup("site.test", { all }, (error, address, family) => resolve({ error, address, family })),
    );
  }

  it("answers both callback shapes Node asks for", async () => {
    const lookup = guardedLookup(isPublicAddress, resolvingTo("8.8.8.8", "2606:4700::1"));

    expect(await run(lookup, true)).toMatchObject({
      error: null,
      address: [
        { address: "8.8.8.8", family: 4 },
        { address: "2606:4700::1", family: 6 },
      ],
    });
    expect(await run(lookup, false)).toMatchObject({
      error: null,
      address: "8.8.8.8",
      family: 4,
    });
  });

  it("fails the lookup if any resolved address is non-public", async () => {
    const lookup = guardedLookup(isPublicAddress, resolvingTo("8.8.8.8", "10.0.0.1"));

    const { error } = await run(lookup, true);
    expect(error?.message).toContain("10.0.0.1");
  });
});
