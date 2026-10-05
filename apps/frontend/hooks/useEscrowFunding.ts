import { useCallback, useRef, useState } from "react";
import {
  DEFAULT_POLL_INTERVAL_MS,
  StellarNetwork,
  awaitConfirmation,
} from "@/lib/transaction-status";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const API_VERSION_PREFIX = "/v1";

/** How long to keep waiting for the chain to confirm a submitted funding tx. */
const CONFIRMATION_TIMEOUT_MS = 60_000;

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
  | "unconfirmed"
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

export interface UseEscrowFundingOptions {
  /** Network the transaction was submitted to. Drives the status source. */
  network?: StellarNetwork;
  /** Delay between confirmation polls. */
  pollInterval?: number;
  /** How long to wait for a terminal chain state before reporting unconfirmed. */
  confirmationTimeoutMs?: number;
  /** Injectable fetch, so confirmation sequences are deterministic in tests. */
  fetchImpl?: typeof fetch;
}

/**
 * Hook for signing and submitting a Stellar payment transaction to fund an escrow.
 *
 * An HTTP 2xx from the funding endpoint only means the backend accepted the
 * signed envelope — it is *not* proof that the transaction reached a ledger.
 * Completion is therefore reported only once the canonical status source
 * confirms it, and a transport failure while waiting leaves the funding
 * `unconfirmed` (resumable) instead of reporting a failed payment.
 */
export const useEscrowFunding = (options: UseEscrowFundingOptions = {}) => {
  const {
    network = "testnet",
    pollInterval = DEFAULT_POLL_INTERVAL_MS,
    confirmationTimeoutMs = CONFIRMATION_TIMEOUT_MS,
    fetchImpl,
  } = options;

  const [state, setState] = useState<FundingState>({
    loading: false,
    error: null,
    txHash: null,
    phase: "idle",
  });
  const abortControllerRef = useRef<AbortController | null>(null);
  const confirmationAbortRef = useRef<AbortController | null>(null);
  const txHashRef = useRef<string | null>(null);

  const waitForConfirmation = useCallback(
    async (txHash: string): Promise<boolean> => {
      const controller = new AbortController();
      confirmationAbortRef.current = controller;

      try {
        const result = await awaitConfirmation({
          txHash,
          network,
          timeoutMs: confirmationTimeoutMs,
          pollInterval,
          signal: controller.signal,
          fetchImpl,
        });

        if (result.kind === "confirmed") {
          setState({ loading: false, error: null, txHash, phase: "complete" });
          return true;
        }

        if (result.kind === "failed") {
          setState({ loading: false, error: result.detail, txHash, phase: "error" });
          return false;
        }

        setState({
          loading: false,
          error:
            "The transaction was submitted but the network has not confirmed it yet. You can resume checking.",
          txHash,
          phase: "unconfirmed",
        });
        return false;
      } finally {
        if (confirmationAbortRef.current === controller) {
          confirmationAbortRef.current = null;
        }
      }
    },
    [confirmationTimeoutMs, fetchImpl, network, pollInterval],
  );

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

      // The submission endpoint accepted the signed envelope, so from here on the
      // question is whether a ledger confirms it — not whether the HTTP call
      // succeeded.
      setState((current: FundingState) => ({ ...current, phase: "confirming" }));

      const { txHash } = await res.json();
      if (!txHash) {
        throw new Error("Funding submission did not return a transaction hash.");
      }

      txHashRef.current = txHash;
      setState((current: FundingState) => ({ ...current, txHash }));

      return await waitForConfirmation(txHash);
    } catch (err: unknown) {
      const timedOut =
        abortController.signal.aborted ||
        (err instanceof Error && err.message === "TRANSACTION_TIMEOUT");
      const txHash = txHashRef.current;
      setState({
        loading: false,
        error: timedOut
          ? "Transaction timed out after 60 seconds. You can cancel and try again."
          : getFundingError(err),
        txHash,
        phase: timedOut ? "timeout" : "error",
      });
      return false;
    } finally {
      window.clearTimeout(timeoutId);
      abortControllerRef.current = null;
    }
  };

  /**
   * Continues waiting for the chain after an `unconfirmed` result, without
   * re-signing or re-submitting anything.
   */
  const resumeConfirmation = useCallback(async (): Promise<boolean> => {
    const txHash = txHashRef.current;
    if (!txHash) return false;

    setState((current: FundingState) => ({
      ...current,
      loading: true,
      error: null,
      phase: "confirming",
    }));

    return waitForConfirmation(txHash);
  }, [waitForConfirmation]);

  const cancelSigning = () => {
    abortControllerRef.current?.abort();
    confirmationAbortRef.current?.abort();
  };

  return { ...state, fundEscrow, resumeConfirmation, cancelSigning };
};
