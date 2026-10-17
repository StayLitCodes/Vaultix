import {
  getConfiguredStellarNetwork,
  isStellarNetworkMismatch,
  normalizeStellarNetwork,
} from "./network";

describe("Stellar network normalization", () => {
  it.each([
    ["PUBLIC", "public"],
    ["mainnet", "public"],
    ["Public Global Stellar Network ; September 2015", "public"],
    ["TESTNET", "testnet"],
    ["Test SDF Network ; September 2015", "testnet"],
  ])("normalizes %s as %s", (value, expected) => {
    expect(normalizeStellarNetwork(value)).toBe(expected);
  });

  it("treats unsupported and missing networks as unknown", () => {
    expect(normalizeStellarNetwork("custom")).toBeNull();
    expect(normalizeStellarNetwork(undefined)).toBeNull();
    expect(isStellarNetworkMismatch(undefined)).toBe(true);
  });

  it("compares normalized provider values against the configured network", () => {
    const previousNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    expect(getConfiguredStellarNetwork()).toBe("testnet");
    expect(isStellarNetworkMismatch("Test SDF Network ; September 2015")).toBe(
      false,
    );
    expect(isStellarNetworkMismatch("PUBLIC")).toBe(true);
    if (previousNetwork === undefined)
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    else process.env.NEXT_PUBLIC_STELLAR_NETWORK = previousNetwork;
  });
});
