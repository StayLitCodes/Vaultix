import { useCallback, useEffect, useState } from 'react';
import { disputeApi, ServerDispute } from '../services/api';
import { FriendlyError, toFriendlyError } from '../utils/errors';

export type DisputeStatus = 'NONE' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface DisputeDetails {
  id: string;
  escrowId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  evidence?: string[];
  adminDecision?: string;
  winner?: 'BUYER' | 'SELLER' | 'SPLIT';
  finalPayouts?: {
    buyerAmount: number;
    sellerAmount: number;
  };
  resolvedAt?: string;
}

const OUTCOME_TO_WINNER: Record<string, DisputeDetails['winner']> = {
  released_to_seller: 'SELLER',
  refunded_to_buyer: 'BUYER',
  split: 'SPLIT',
};

/** Backend stores reason + description as a single `reason` field. */
const composeReason = (reason: string, description: string) =>
  description ? `${reason}\n\n${description}` : reason;

const mapServerDispute = (d: ServerDispute): DisputeDetails => {
  const [reason, ...rest] = (d.reason ?? '').split('\n\n');
  return {
    id: d.id,
    escrowId: d.escrowId,
    reason,
    description: rest.join('\n\n'),
    status: (d.status?.toUpperCase() as DisputeStatus) ?? 'OPEN',
    evidence: d.evidence ?? undefined,
    adminDecision: d.resolutionNotes ?? undefined,
    winner: d.outcome ? OUTCOME_TO_WINNER[d.outcome] : undefined,
    resolvedAt: d.resolvedAt ?? undefined,
  };
};

const isNotFound = (error: unknown) =>
  (error as { response?: { status?: number } })?.response?.status === 404;

export const useDisputes = (escrowId?: string, initialDispute?: DisputeDetails) => {
  const [dispute, setDispute] = useState<DisputeDetails | undefined>(initialDispute);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<FriendlyError | null>(null);

  const refresh = useCallback(async () => {
    if (!escrowId) return;
    setIsLoading(true);
    try {
      const server = await disputeApi.get(escrowId);
      setDispute(server ? mapServerDispute(server) : undefined);
      setError(null);
    } catch (err) {
      if (isNotFound(err)) {
        setDispute(undefined);
      } else {
        setError(toFriendlyError(err));
      }
    } finally {
      setIsLoading(false);
    }
  }, [escrowId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const raiseDispute = async (
    targetEscrowId: string,
    reason: string,
    description: string,
    evidence?: string[],
  ) => {
    setIsSubmitting(true);
    setError(null);
    const previous = dispute;
    // Optimistic placeholder, reconciled with the server response below
    setDispute({
      id: `pending_${Date.now()}`,
      escrowId: targetEscrowId,
      reason,
      description,
      status: 'OPEN',
      evidence,
    });
    try {
      const created = await disputeApi.file(targetEscrowId, {
        reason: composeReason(reason, description),
        evidence,
      });
      const mapped = mapServerDispute(created);
      setDispute(mapped);
      return { success: true as const, dispute: mapped };
    } catch (err) {
      setDispute(previous);
      const friendly = toFriendlyError(err);
      setError(friendly);
      return { success: false as const, error: friendly };
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasActiveDispute = dispute?.status === 'OPEN' || dispute?.status === 'UNDER_REVIEW';

  return {
    dispute,
    isSubmitting,
    isLoading,
    error,
    raiseDispute,
    refresh,
    hasActiveDispute,
  };
};
