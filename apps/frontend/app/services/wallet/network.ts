export type StellarNetwork = "public" | "testnet";

export const normalizeStellarNetwork = (
  network: string | null | undefined,
): StellarNetwork | null => {
  const value = network?.trim().toLowerCase();
  if (!value) return null;
  if (
    value === "public" ||
    value === "mainnet" ||
    value.includes("public global stellar network")
  ) {
    return "public";
  }
  if (value === "testnet" || value.includes("test sdf network"))
    return "testnet";
  return null;
};

export const getConfiguredStellarNetwork = (): StellarNetwork | null =>
  normalizeStellarNetwork(process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet");

export const isStellarNetworkMismatch = (
  walletNetwork: string | null | undefined,
): boolean => {
  const connectedNetwork = normalizeStellarNetwork(walletNetwork);
  const configuredNetwork = getConfiguredStellarNetwork();
  return (
    !connectedNetwork ||
    !configuredNetwork ||
    connectedNetwork !== configuredNetwork
  );
};
