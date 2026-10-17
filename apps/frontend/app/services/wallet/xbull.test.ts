import { WalletServiceFactory, WalletType } from "./index";
import { XBullService } from "./xbull";

describe("xBull wallet service", () => {
  afterEach(() => {
    delete window.xBullSDK;
  });

  it("discovers an injected xBull provider", async () => {
    window.xBullSDK = {
      connect: jest.fn().mockResolvedValue({ publicKey: "GTEST" }),
      signTransaction: jest.fn(),
      network: "TESTNET",
    };
    expect(await WalletServiceFactory.getAvailableWallets()).toContain(
      WalletType.XBULL,
    );
  });

  it("connects, reads its network, and signs via the xBull provider", async () => {
    const signTransaction = jest
      .fn()
      .mockResolvedValue({ signedXDR: "signed-xdr" });
    window.xBullSDK = {
      connect: jest.fn().mockResolvedValue({}),
      getAddress: jest.fn().mockResolvedValue({ address: "GTEST" }),
      getNetwork: jest.fn().mockResolvedValue({ network: "TESTNET" }),
      signTransaction,
    };
    const service = XBullService.getInstance();

    await expect(service.connect()).resolves.toBe("GTEST");
    await expect(service.getNetwork()).resolves.toBe("TESTNET");
    await expect(service.signTransaction("unsigned-xdr")).resolves.toBe(
      "signed-xdr",
    );
    expect(signTransaction).toHaveBeenCalledWith({
      xdr: "unsigned-xdr",
      opts: {
        networkPassphrase: "Test SDF Network ; September 2015",
        address: "GTEST",
      },
    });
  });

  it("reports missing providers and invalid signing results", async () => {
    const service = XBullService.getInstance();
    await expect(service.connect()).rejects.toThrow(/not installed/i);

    window.xBullSDK = {
      connect: jest.fn().mockResolvedValue({}),
      getAddress: jest.fn().mockResolvedValue({ address: "GTEST" }),
      getNetwork: jest.fn().mockResolvedValue("TESTNET"),
      signTransaction: jest.fn().mockResolvedValue(undefined),
    };
    await expect(service.signTransaction("unsigned-xdr")).rejects.toThrow(
      /did not return a signed transaction/i,
    );
  });
});
