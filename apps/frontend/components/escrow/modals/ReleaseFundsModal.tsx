"use client";

import React, { useMemo, useState } from "react";
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

const PLATFORM_FEE_BPS = 50;
const BPS_DENOMINATOR = 10_000;

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
    setError(null);
    setIsSubmitting(false);
    setStep(isAlreadyReleased ? "success" : "review");
    onClose();
  };

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

      try {
        const response = await fetch(`/api/escrows/${escrow.id}/release`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
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

        setStep("success");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to release funds. Please try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const primaryLabel = (() => {
    if (step === "review") return "Release funds";
    if (step === "confirm") return "Confirm release";
    return "Done";
  })();

  const primaryDisabled = isSubmitting || (!connected && step !== "success");

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
                  <span>Releasing...</span>
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
