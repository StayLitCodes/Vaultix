interface XBullProvider {
  connect?: (permissions: {
    canRequestPublicKey: boolean;
    canRequestSign: boolean;
  }) => Promise<unknown>;
  getAddress?: () => Promise<unknown>;
  getPublicKey?: () => Promise<unknown>;
  getNetwork?: () => Promise<unknown>;
  signTransaction?: (params: {
    xdr: string;
    opts?: { networkPassphrase?: string; address?: string };
  }) => Promise<unknown>;
  signXDR?: (
    xdr: string,
    options: { network?: string; publicKey?: string },
  ) => Promise<unknown>;
  network?: string;
}

declare global {
  interface Window {
    xBullSDK?: XBullProvider;
  }
}

const getProvider = (): XBullProvider | undefined =>
  typeof window === "undefined" ? undefined : window.xBullSDK;

const readString = (value: unknown, keys: string[]): string => {
  if (typeof value === "string") return value;
  if (typeof value !== "object" || value === null) return "";
  for (const key of keys) {
    const field = (value as Record<string, unknown>)[key];
    if (typeof field === "string" && field) return field;
  }
  return "";
};

export class XBullService {
  private static instance: XBullService;

  private constructor() {}

  public static getInstance(): XBullService {
    if (!XBullService.instance) XBullService.instance = new XBullService();
    return XBullService.instance;
  }

  async isInstalled(): Promise<boolean> {
    return Boolean(getProvider());
  }

  async connect(): Promise<string> {
    const provider = getProvider();
    if (!provider) throw new Error("xBull wallet is not installed.");

    try {
      if (provider.connect) {
        await provider.connect({
          canRequestPublicKey: true,
          canRequestSign: true,
        });
      }
      const addressResult = provider.getAddress
        ? await provider.getAddress()
        : await provider.getPublicKey?.();
      const publicKey = readString(addressResult, [
        "address",
        "publicKey",
        "pubkey",
      ]);
      if (!publicKey) throw new Error("xBull did not return a public key.");
      return publicKey;
    } catch (error) {
      throw new Error(
        `Failed to connect to xBull: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async getNetwork(): Promise<string> {
    const provider = getProvider();
    if (!provider) throw new Error("xBull wallet is not installed.");
    const result = provider.getNetwork
      ? await provider.getNetwork()
      : provider.network;
    if (typeof result === "object" && result !== null && "error" in result) {
      const error = (result as { error?: { message?: string } }).error;
      throw new Error(
        error?.message || "xBull could not verify its active network.",
      );
    }
    const network = readString(result, ["network", "networkName", "id"]);
    if (!network)
      throw new Error("xBull did not report its active Stellar network.");
    return network;
  }

  async signTransaction(xdr: string, publicKey?: string): Promise<string> {
    const provider = getProvider();
    if (!provider) throw new Error("xBull wallet is not installed.");
    const network = await this.getNetwork();
    const addressResult = publicKey
      ? undefined
      : provider.getAddress
        ? await provider.getAddress()
        : await provider.getPublicKey?.();
    const address =
      publicKey ||
      readString(addressResult, ["address", "publicKey", "pubkey"]);
    if (!address)
      throw new Error("xBull did not return the active public key.");
    const networkPassphrase = network.toLowerCase().includes("public")
      ? "Public Global Stellar Network ; September 2015"
      : "Test SDF Network ; September 2015";
    const result = provider.signTransaction
      ? await provider.signTransaction({
          xdr,
          opts: { networkPassphrase, address },
        })
      : provider.signXDR
        ? await provider.signXDR(xdr, {
            network: networkPassphrase,
            publicKey: address,
          })
        : undefined;
    if (typeof result === "object" && result !== null && "error" in result) {
      const error = (result as { error?: { message?: string } }).error;
      throw new Error(
        error?.message || "xBull could not sign the transaction.",
      );
    }
    const signedXdr = readString(result, [
      "signedXDR",
      "signedTxXdr",
      "signed_envelope_xdr",
    ]);
    if (!signedXdr)
      throw new Error("xBull did not return a signed transaction.");
    return signedXdr;
  }
}
