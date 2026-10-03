import { act, renderHook, waitFor } from "@testing-library/react";
import { useEscrowFunding } from "./useEscrowFunding";

const FUND_URL = /\/escrows\/.*\/fund$/;
const HORIZON_URL = /horizon.*\.stellar\.org\/transactions\//;

const submitted = (txHash: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ txHash }),
  }) as Response;

const chain = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as Response;

const transportError = (code: number) =>
  ({
    ok: false,
    status: code,
    json: async () => ({}),
  }) as Response;

describe("useEscrowFunding", () => {
  const originalFreighter = (window as any).freighter;

  afterEach(() => {
    (window as any).freighter = originalFreighter;
    jest.restoreAllMocks();
  });

  it("transitions through building, wallet, submitting, confirming, and complete", async () => {
    let resolveSigning!: (value: { signedXDR: string }) => void;
    let resolveResponseBody!: (value: { txHash: string }) => void;
    const signing = new Promise<{ signedXDR: string }>((resolve) => {
      resolveSigning = resolve;
    });
    const responseBody = new Promise<{ txHash: string }>((resolve) => {
      resolveResponseBody = resolve;
    });
    (window as any).freighter = { signTransaction: jest.fn(() => signing) };
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (FUND_URL.test(String(url))) {
        return { ok: true, status: 200, json: () => responseBody } as Response;
      }
      return chain({ successful: true, ledger: 101 });
    });

    const { result } = renderHook(() =>
      useEscrowFunding({ pollInterval: 5, confirmationTimeoutMs: 500 })
    );

    let funding!: Promise<boolean>;
    await act(async () => {
      funding = result.current.fundEscrow("escrow_123", "unsigned-xdr");
      await Promise.resolve();
    });
    expect(result.current.phase).toBe("waiting");

    await act(async () => {
      resolveSigning({ signedXDR: "signed-xdr" });
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    await waitFor(() => expect(result.current.phase).toBe("confirming"));

    await act(async () => {
      resolveResponseBody({ txHash: "tx_hash_123" });
      await funding;
    });
    expect(result.current.phase).toBe("complete");
    expect(result.current.txHash).toBe("tx_hash_123");
  });

  it("does not treat an accepted submission as on-chain completion", async () => {
    (window as any).freighter = {
      signTransaction: jest.fn().mockResolvedValue({ signedXDR: "signed-xdr" }),
    };
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (FUND_URL.test(String(url))) return submitted("tx_hash_unconfirmed");
      // Horizon has not indexed it within the confirmation window.
      return transportError(404);
    });

    const { result } = renderHook(() =>
      useEscrowFunding({ pollInterval: 5, confirmationTimeoutMs: 30 })
    );

    let ok!: boolean;
    await act(async () => {
      ok = await result.current.fundEscrow("escrow_123", "unsigned-xdr");
    });

    expect(ok).toBe(false);
    expect(result.current.phase).toBe("unconfirmed");
    // The hash is retained so the user can follow the transaction.
    expect(result.current.txHash).toBe("tx_hash_unconfirmed");
    expect(result.current.error).toMatch(/has not confirmed it yet/i);
  });

  it("keeps waiting through a transient outage instead of reporting a failed payment", async () => {
    (window as any).freighter = {
      signTransaction: jest.fn().mockResolvedValue({ signedXDR: "signed-xdr" }),
    };
    let chainCalls = 0;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (FUND_URL.test(String(url))) return submitted("tx_hash_flaky");
      chainCalls += 1;
      if (chainCalls === 1) return transportError(503);
      if (chainCalls === 2) throw new TypeError("Failed to fetch");
      return chain({ successful: true, ledger: 202 });
    });

    const { result } = renderHook(() =>
      useEscrowFunding({ pollInterval: 5, confirmationTimeoutMs: 2000 })
    );

    let ok!: boolean;
    await act(async () => {
      ok = await result.current.fundEscrow("escrow_123", "unsigned-xdr");
    });

    expect(ok).toBe(true);
    expect(result.current.phase).toBe("complete");
    expect(result.current.error).toBeNull();
    expect(chainCalls).toBe(3);
  });

  it("reports the chain's own verdict when a ledger marks the transaction unsuccessful", async () => {
    (window as any).freighter = {
      signTransaction: jest.fn().mockResolvedValue({ signedXDR: "signed-xdr" }),
    };
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (FUND_URL.test(String(url))) return submitted("tx_hash_failed");
      return chain({ successful: false });
    });

    const { result } = renderHook(() =>
      useEscrowFunding({ pollInterval: 5, confirmationTimeoutMs: 500 })
    );

    let ok!: boolean;
    await act(async () => {
      ok = await result.current.fundEscrow("escrow_123", "unsigned-xdr");
    });

    expect(ok).toBe(false);
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toMatch(/failed on-chain|was not successful/i);
  });

  it("resumes confirmation without re-submitting", async () => {
    (window as any).freighter = {
      signTransaction: jest.fn().mockResolvedValue({ signedXDR: "signed-xdr" }),
    };
    let chainCalls = 0;
    let chainAnswering = false;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      if (FUND_URL.test(String(url))) return submitted("tx_hash_resume");
      chainCalls += 1;
      return chainAnswering ? chain({ successful: true, ledger: 303 }) : transportError(404);
    });

    const { result } = renderHook(() =>
      useEscrowFunding({ pollInterval: 5, confirmationTimeoutMs: 25 })
    );

    await act(async () => {
      await result.current.fundEscrow("escrow_123", "unsigned-xdr");
    });
    expect(result.current.phase).toBe("unconfirmed");
    expect(chainCalls).toBeGreaterThan(0);

    chainAnswering = true;

    await act(async () => {
      await result.current.resumeConfirmation();
    });

    expect(result.current.phase).toBe("complete");
    expect(
      (global.fetch as jest.Mock).mock.calls.filter((call) => FUND_URL.test(String(call[0]))).length
    ).toBe(1);
  });

  it("reports specific errors and supports cancellation", async () => {
    let rejectSigning!: (error: Error) => void;
    const signing = new Promise<never>((_, reject) => {
      rejectSigning = reject;
    });
    (window as any).freighter = { signTransaction: jest.fn(() => signing) };
    const { result } = renderHook(() => useEscrowFunding());

    let funding!: Promise<boolean>;
    await act(async () => {
      funding = result.current.fundEscrow("escrow_123", "unsigned-xdr");
      await Promise.resolve();
    });
    expect(result.current.phase).toBe("waiting");

    await act(async () => {
      rejectSigning(new Error("insufficient balance"));
      await funding;
    });
    expect(result.current.phase).toBe("error");
    expect(result.current.error).toContain("Insufficient balance");
  });
});
