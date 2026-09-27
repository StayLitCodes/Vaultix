import { useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const API_VERSION_PREFIX = "/v1";

export interface FundingState {
  loading: boolean;
  error: string | null;
  txHash: string | null;
  phase: FundingPhase;
}

export type FundingPhase =
  | "idle"
  | "building"
  | "waiting"
  | "submitting"
  | "confirming"
  | "complete"
  | "error"
  | "timeout";

const SIGNING_TIMEOUT_MS = 60_000;

const getFundingError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();

  if (normalized.includes("balance") || normalized.includes("underfunded")) {
    return "Insufficient balance to fund this escrow, including the network fee.";
  }
  if (normalized.includes("sequence") || normalized.includes("tx_bad_seq")) {
    return "Your wallet sequence number is out of date. Refresh your wallet and try again.";
  }
  if (normalized.includes("network") || normalized.includes("fetch")) {
    return "A network error prevented the transaction from being submitted.";
  }

  return message || "The transaction could not be completed.";
};

/**
 * Hook for signing and submitting a Stellar payment transaction to fund an escrow.
 * Calls the wallet's signTransaction method and submits to the backend.
 */
export const useEscrowFunding = () => {
  const [state, setState] = useState<FundingState>({
    loading: false,
    error: null,
    txHash: null,
    phase: "idle",
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const fundEscrow = async (
    escrowId: string,
    xdr: string,
  ): Promise<boolean> => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    let rejectTimeout!: (error: Error) => void;
    const timeoutPromise = new Promise<never>((_, reject) => {
      rejectTimeout = reject;
    });
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
      rejectTimeout(new Error("TRANSACTION_TIMEOUT"));
    }, SIGNING_TIMEOUT_MS);

    setState({ loading: true, error: null, txHash: null, phase: "building" });
    try {
      await Promise.resolve();
      setState((current: FundingState) => ({ ...current, phase: "waiting" }));

      // Sign the XDR envelope via the injected wallet
      const signedResponse = await Promise.race([
        (window as any).freighter.signTransaction(xdr, {
          networkPassphrase: "Test SDF Network ; September 2015",
        }),
        timeoutPromise,
      ]);
      const signedXDR = signedResponse.signedXDR ?? signedResponse.signedTxXdr;

      setState((current: FundingState) => ({ ...current, phase: "submitting" }));

      const res = await fetch(
        `${API_URL}${API_VERSION_PREFIX}/escrows/${escrowId}/fund`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signedXDR }),
          signal: abortController.signal,
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Funding submission failed");
      }

      setState((current: FundingState) => ({ ...current, phase: "confirming" }));
      const { txHash } = await res.json();
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      setState({ loading: false, error: null, txHash, phase: "complete" });
      return true;
    } catch (err: unknown) {
      const timedOut =
        abortController.signal.aborted ||
        (err instanceof Error && err.message === "TRANSACTION_TIMEOUT");
      setState({
        loading: false,
        error: timedOut
          ? "Transaction timed out after 60 seconds. You can cancel and try again."
          : getFundingError(err),
        txHash: null,
        phase: timedOut ? "timeout" : "error",
      });
      return false;
    } finally {
      window.clearTimeout(timeoutId);
      abortControllerRef.current = null;
    }
  };

  const cancelSigning = () => {
    abortControllerRef.current?.abort();
  };

  return { ...state, fundEscrow, cancelSigning };
};
