import { act, renderHook, waitFor } from "@testing-library/react";
import { useEscrowFunding } from "./useEscrowFunding";

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
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => responseBody,
    });
    const { result } = renderHook(() => useEscrowFunding());

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
