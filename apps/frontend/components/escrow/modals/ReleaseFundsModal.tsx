"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Loader2,
  User,
  Wallet,
  X,
  Info,
} from "lucide-react";
import { IEscrowExtended } from "@/types/escrow";
import TransactionTracker from "@/components/stellar/TransactionTracker";
import { toast } from "sonner";

type ReleaseMode = "manual" | "auto";

interface ReleaseFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  escrow: IEscrowExtended;
  releaseMode?: ReleaseMode;
  connected: boolean;
  connect: () => void;
  publicKey: string | null;
  network?: "testnet" | "public";
}

type Step = "review" | "confirm" | "success";
type SigningPhase = "idle" | "building" | "waiting" | "submitting" | "confirming" | "complete" | "timeout";

const PLATFORM_FEE_BPS = 50;
const BPS_DENOMINATOR = 10_000;
const NETWORK_FEE = "0.00001 XLM";
const SIGNING_TIMEOUT_MS = 60_000;

const getReleaseError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes("balance") || normalized.includes("underfunded")) {
    return "Insufficient balance to release funds, including the network fee.";
  }
  if (normalized.includes("sequence") || normalized.includes("tx_bad_seq")) {
    return "Your wallet sequence number is out of date. Refresh your wallet and try again.";
  }
  if (normalized.includes("fetch") || normalized.includes("network")) {
    return "A network error prevented the transaction from being submitted.";
  }
  return message || "Failed to release funds. Please try again.";
};

export const ReleaseFundsModal: React.FC<ReleaseFundsModalProps> = ({
  isOpen,
  onClose,
  escrow,
  releaseMode = "manual",
  connected,
  connect,
  publicKey,
  network = "testnet",
}) => {
  const router = useRouter();
  const existingTxHash =
    (escrow as any).releaseTransactionHash ??
    (escrow as any).onChainReleaseHash ??
    null;

  const isAlreadyReleased =
    Boolean(existingTxHash) ||
    ["completed", "released", "COMPLETED", "RELEASED"].includes(escrow.status);

  const [step, setStep] = useState<Step>(
    isAlreadyReleased ? "success" : "review",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(existingTxHash ?? null);
  const [signingPhase, setSigningPhase] = useState<SigningPhase>("idle");
  const abortControllerRef = useRef<AbortController | null>(null);

  const sellerAddress =
    escrow.counterpartyAddress || (escrow as any).sellerAddress || "Unknown";
  const buyerAddress =
    escrow.creatorAddress || (escrow.creator && escrow.creator.walletAddress);

  const formattedAmount = useMemo(() => {
    const num = Number(escrow.amount);
    if (Number.isNaN(num)) return `${escrow.amount} ${escrow.asset}`;
    return `${num.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 7,
    })} ${escrow.asset}`;
  }, [escrow.amount, escrow.asset]);

  const { feeAmount, recipientAmount } = useMemo(() => {
    const rawAmount = Number(escrow.amount);
    if (Number.isNaN(rawAmount)) {
      return { feeAmount: null, recipientAmount: null };
    }

    const fee = (rawAmount * PLATFORM_FEE_BPS) / BPS_DENOMINATOR;
    const recipient = rawAmount - fee;

    return {
      feeAmount: `${fee.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 7,
      })} ${escrow.asset}`,
      recipientAmount: `${recipient.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 7,
      })} ${escrow.asset}`,
    };
  }, [escrow.amount, escrow.asset]);

  const handleClose = () => {
    abortControllerRef.current?.abort();
    setError(null);
    setIsSubmitting(false);
    setSigningPhase("idle");
    setStep(isAlreadyReleased ? "success" : "review");
    onClose();
  };

  useEffect(() => {
    if (step !== "success") return;
    const timeoutId = window.setTimeout(() => {
      onClose();
      router.push(`/escrow/${escrow.id}`);
    }, 3_000);
    return () => window.clearTimeout(timeoutId);
  }, [escrow.id, onClose, router, step]);

  const signingLabel = {
    idle: "",
    building: "Building Transaction",
    waiting: "Waiting for Wallet",
    submitting: "Submitting",
    confirming: "Confirming",
    complete: "Complete",
    timeout: "Timed Out",
  }[signingPhase];

  const handlePrimaryAction = async () => {
    if (step === "review") {
      setStep("confirm");
      return;
    }

    if (step === "confirm") {
      if (!connected || !publicKey) {
        setError("Connect your wallet before releasing funds.");
        return;
      }

      setIsSubmitting(true);
      setError(null);
      setSigningPhase("building");
      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      const timeoutId = window.setTimeout(() => abortController.abort(), SIGNING_TIMEOUT_MS);

      try {
        await Promise.resolve();
        setSigningPhase("waiting");
        await Promise.resolve();
        setSigningPhase("submitting");
        const response = await fetch(`/api/escrows/${escrow.id}/release`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          const data = await response
            .json()
            .catch(() => ({ message: "Failed to release funds" }));
          throw new Error(
            data.message || "Failed to release funds. Please try again.",
          );
        }

        const data = (await response.json()) as {
          transactionHash?: string;
          status?: string;
        };

        if (data.transactionHash) {
          setTxHash(data.transactionHash);
        }

        setSigningPhase("confirming");
        await new Promise((resolve) => window.setTimeout(resolve, 150));
        setStep("success");
        toast.success(
          data.transactionHash
            ? `Release confirmed: ${data.transactionHash}`
            : "Escrow funds released successfully",
        );
      } catch (err) {
        const timedOut = abortController.signal.aborted;
        setSigningPhase(timedOut ? "timeout" : "idle");
        setError(
          timedOut
            ? "Transaction timed out after 60 seconds. Cancel and try again."
            : getReleaseError(err),
        );
      } finally {
        window.clearTimeout(timeoutId);
        abortControllerRef.current = null;
        setIsSubmitting(false);
      }
    }
  };

  const primaryLabel = (() => {
    if (step === "review") return "Release funds";
    if (step === "confirm") return "Confirm release";
    return "Done";
  })();

  const isSigning = isSubmitting || signingPhase === "timeout";
  const primaryDisabled = isSigning;

  const showTracker = step === "success" && txHash;

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white">
                {isAlreadyReleased || step === "success"
                  ? "Funds released"
                  : "Release escrowed funds"}
              </h2>
              <p className="text-emerald-100 text-sm mt-1">
                {releaseMode === "manual"
                  ? "Review the payout details before releasing funds to the seller."
                  : "This escrow is eligible for auto-release. Review the details before the on-chain payout."}
              </p>
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm" data-testid="release-error">
                {error}
              </p>
            </div>
          )}

          {isSubmitting && signingLabel && (
            <div
              className="p-4 rounded-lg border border-blue-200 bg-blue-50"
              data-testid="signing-status"
            >
              <div className="flex items-center gap-3 text-blue-800 font-medium">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{signingLabel}</span>
              </div>
              <div className="mt-3 grid grid-cols-4 gap-1" aria-label="Transaction progress">
                {["building", "waiting", "submitting", "confirming"].map((phase) => (
                  <div
                    key={phase}
                    className={`h-1 rounded ${phase === signingPhase ? "bg-blue-600" : "bg-blue-200"}`}
                  />
                ))}
              </div>
            </div>
          )}

          {!isAlreadyReleased && step !== "success" && (
            <div
              className={`p-4 rounded-lg border ${
                step === "confirm"
                  ? "bg-amber-50 border-amber-200"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-start space-x-3">
                {step === "confirm" ? (
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <Info className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <h4
                    className={`font-semibold ${
                      step === "confirm" ? "text-amber-800" : "text-slate-900"
                    }`}
                  >
                    {step === "confirm"
                      ? "Confirm on-chain release"
                      : "Review payout details"}
                  </h4>
                  <p
                    className={`text-sm mt-1 ${
                      step === "confirm" ? "text-amber-700" : "text-slate-600"
                    }`}
                  >
                    {step === "confirm"
                      ? "This will submit a blockchain transaction to release escrowed funds. This action cannot be undone."
                      : "You are about to release escrowed funds to the seller. Confirm the amount, recipient, and fee before continuing."}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Release summary
            </h3>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-start space-x-3">
                <DollarSign className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Gross amount</p>
                  <p className="font-medium text-gray-900">{formattedAmount}</p>
                  {recipientAmount && (
                    <p className="text-xs text-gray-500 mt-1">
                      After fees, the seller receives{" "}
                      <span className="font-medium">{recipientAmount}</span>.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <User className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Recipient (seller)</p>
                  <p className="font-mono text-sm text-gray-900 break-all">
                    {sellerAddress}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Wallet className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-gray-500">Your connected wallet</p>
                  {connected && publicKey ? (
                    <p className="font-mono text-sm text-gray-900 break-all">
                      {publicKey}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-700">
                      No wallet connected.{" "}
                      <button
                        type="button"
                        className="underline text-emerald-700 font-medium"
                        onClick={connect}
                      >
                        Connect to continue.
                      </button>
                    </p>
                  )}
                </div>
              </div>

              {feeAmount && (
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">
                      Platform fee (estimated)
                    </p>
                    <p className="text-sm text-gray-900">
                      {feeAmount} ({PLATFORM_FEE_BPS / 100}
                      %)
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Based on the current on-chain configuration. The exact fee
                      may differ slightly at execution time.
                    </p>
                  </div>
                </div>
              )}

              {step === "confirm" && (
                <div className="flex items-start space-x-3">
                  <Info className="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Estimated network fee</p>
                    <p className="text-sm text-gray-900">{NETWORK_FEE}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {step === "success" && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50 flex items-start space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-emerald-800">
                    Funds successfully released
                  </h4>
                  <p className="text-sm text-emerald-700 mt-1">
                    The escrow has been marked as completed and the on-chain
                    payout transaction has been submitted.
                  </p>
                </div>
              </div>

              {txHash && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">Transaction hash:</span>{" "}
                    <span className="font-mono break-all">{txHash}</span>
                  </p>
                  <a
                    href={`https://stellar.expert/explorer/${network}/tx/${txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm text-emerald-700 underline"
                  >
                    View transaction on Stellar explorer
                  </a>
                  <TransactionTracker
                    txHash={txHash}
                    network={network}
                    pollInterval={3_000}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {step === "success" ? "Close" : "Cancel"}
            </button>
            <button
              type="button"
              onClick={handlePrimaryAction}
              disabled={primaryDisabled}
              className={`flex-1 px-4 py-2.5 font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                step === "success"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
                  : step === "confirm"
                    ? "bg-emerald-600 text-white hover:bg-emerald-700 focus:ring-emerald-500"
                    : "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500"
              }`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{signingLabel ?? "Releasing..."}</span>
                </span>
              ) : (
                primaryLabel
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReleaseFundsModal;
