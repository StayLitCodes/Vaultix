import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { WalletProvider, useWallet } from "./WalletContext";
import {
  IWalletService,
  WalletServiceFactory,
  WalletType,
} from "../services/wallet";

const WalletHarness = () => {
  const { connect, signTransaction, isNetworkMismatch, refreshNetwork } =
    useWallet();
  const [result, setResult] = React.useState("");
  return (
    <>
      <button onClick={() => connect(WalletType.FREIGHTER)}>Connect</button>
      <button
        onClick={() =>
          signTransaction("unsigned-xdr")
            .then(setResult)
            .catch((error) => setResult(error.message))
        }
      >
        Sign
      </button>
      <button onClick={() => refreshNetwork()}>Recheck network</button>
      <div>{isNetworkMismatch ? "network-mismatch" : "network-matches"}</div>
      <div>{result}</div>
    </>
  );
};

describe("WalletContext network safety", () => {
  const originalNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK;
  let service: IWalletService;

  beforeEach(() => {
    window.localStorage.clear();
    process.env.NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    service = {
      connect: jest.fn().mockResolvedValue("GTEST"),
      getNetwork: jest.fn().mockResolvedValue("TESTNET"),
      signTransaction: jest.fn().mockResolvedValue("signed-xdr"),
    };
    jest.spyOn(WalletServiceFactory, "getService").mockReturnValue(service);
  });

  afterEach(() => {
    window.localStorage.clear();
    if (originalNetwork === undefined)
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    else process.env.NEXT_PUBLIC_STELLAR_NETWORK = originalNetwork;
    jest.restoreAllMocks();
  });

  it("allows signing when the provider reports the configured network", async () => {
    render(
      <WalletProvider>
        <WalletHarness />
      </WalletProvider>,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Connect" })),
    );
    expect(screen.getByText("network-matches")).toBeInTheDocument();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Sign" })),
    );
    await waitFor(() =>
      expect(screen.getByText("signed-xdr")).toBeInTheDocument(),
    );
    expect(service.signTransaction).toHaveBeenCalledWith(
      "unsigned-xdr",
      "GTEST",
    );
  });

  it("blocks signing when the provider network differs or cannot be verified", async () => {
    (service.getNetwork as jest.Mock).mockResolvedValue("PUBLIC");
    render(
      <WalletProvider>
        <WalletHarness />
      </WalletProvider>,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Connect" })),
    );
    expect(screen.getByText("network-mismatch")).toBeInTheDocument();
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Sign" })),
    );
    await waitFor(() =>
      expect(screen.getByText(/signing is blocked/i)).toBeInTheDocument(),
    );
    expect(service.signTransaction).not.toHaveBeenCalled();

    (service.getNetwork as jest.Mock).mockRejectedValue(
      new Error("provider unavailable"),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Sign" })),
    );
    await waitFor(() =>
      expect(screen.getByText(/unknown network/i)).toBeInTheDocument(),
    );
  });

  it("refreshes the displayed connection network after a wallet network switch", async () => {
    render(
      <WalletProvider>
        <WalletHarness />
      </WalletProvider>,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Connect" })),
    );
    (service.getNetwork as jest.Mock).mockResolvedValue("PUBLIC");
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Recheck network" })),
    );
    expect(screen.getByText("network-mismatch")).toBeInTheDocument();
  });

  it.each([
    ["User rejected the transaction", /signing was cancelled/i],
    ["Wallet is locked", /wallet is locked/i],
  ])("shows actionable signing errors for %s", async (message, expected) => {
    (service.signTransaction as jest.Mock).mockRejectedValue(
      new Error(message),
    );
    render(
      <WalletProvider>
        <WalletHarness />
      </WalletProvider>,
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Connect" })),
    );
    await act(async () =>
      fireEvent.click(screen.getByRole("button", { name: "Sign" })),
    );
    await waitFor(() => expect(screen.getByText(expected)).toBeInTheDocument());
  });
});
