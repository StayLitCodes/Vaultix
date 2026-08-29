import { useState, useCallback } from 'react';
import { api } from '../services/api';
import { disputeApi } from '../services/api';
import { toFriendlyError, type FriendlyError } from '../utils/errors';

export type DisputeStatus = 'NONE' | 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';

export interface DisputeDetails {
  id: string;
  escrowId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  adminDecision?: string;
  winner?: 'BUYER' | 'SELLER' | 'SPLIT';
  finalPayouts?: {
    buyerAmount: number;
    sellerAmount: number;
  };
  resolvedAt?: string;
  evidence?: string[];
}

export interface RaiseDisputeResult {
  success: boolean;
  dispute?: DisputeDetails;
  error?: FriendlyError;
}

/**
 * Maps the backend's Dispute entity (snake_case) to the mobile DisputeDetails
 * (camelCase) shape used by the UI components.
 *
 * Backend statuses are lowercase ('open', 'under_review', 'resolved').
 * Mobile expects uppercase ('OPEN', 'UNDER_REVIEW', 'RESOLVED').
 */
function mapBackendDispute(d: Record<string, unknown>): DisputeDetails {
  const rawStatus = String(d.status ?? 'open').toUpperCase();
  const status: DisputeStatus = rawStatus === 'UNDER_REVIEW'
    ? 'UNDER_REVIEW'
    : rawStatus === 'RESOLVED'
      ? 'RESOLVED'
      : 'OPEN';

  const outcome = d.outcome as string | null;
  let winner: DisputeDetails['winner'];
  if (outcome === 'released_to_seller') winner = 'SELLER';
  else if (outcome === 'refunded_to_buyer') winner = 'BUYER';
  else if (outcome === 'split') winner = 'SPLIT';

  const sellerPercent = d.sellerPercent != null ? Number(d.sellerPercent) : undefined;
  const buyerPercent = d.buyerPercent != null ? Number(d.buyerPercent) : undefined;

  let finalPayouts: DisputeDetails['finalPayouts'];
  if (sellerPercent != null && buyerPercent != null) {
    finalPayouts = { buyerAmount: buyerPercent, sellerAmount: sellerPercent };
  }

  return {
    id: String(d.id ?? ''),
    escrowId: String(d.escrowId ?? ''),
    reason: String(d.reason ?? ''),
    description: String(d.reason ?? ''),
    status,
    adminDecision: d.resolutionNotes != null ? String(d.resolutionNotes) : undefined,
    winner,
    finalPayouts,
    resolvedAt: d.resolvedAt != null ? String(d.resolvedAt) : undefined,
    evidence: Array.isArray(d.evidence) ? (d.evidence as string[]) : undefined,
  };
}

export const useDisputes = (initialDispute?: DisputeDetails) => {
  const [dispute, setDispute] = useState<DisputeDetails | undefined>(initialDispute);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Raise a dispute against an escrow by POSTing to the backend dispute endpoint.
   * Uses optimistic local state with server reconciliation — a temporary dispute
   * object is set immediately and then replaced with the server's response.
   *
   * On failure, the optimistic state is rolled back and the error is surfaced
   * through `toFriendlyError` so callers can display a user-friendly message
   * and keep the modal open for retry.
   */
  const raiseDispute = useCallback(async (
    escrowId: string,
    reason: string,
    description: string,
    evidenceFiles?: Array<{ uri: string; name: string; type: string }>,
  ): Promise<RaiseDisputeResult> => {
    setIsSubmitting(true);

    // Optimistic: set a temporary local dispute so the UI reflects the action immediately.
    const tempDispute: DisputeDetails = {
      id: `temp_${Date.now()}`,
      escrowId,
      reason,
      description,
      status: 'OPEN',
    };
    setDispute(tempDispute);

    try {
      // Upload evidence files first (if any) and collect their CIDs/URLs.
      let evidenceUrls: string[] | undefined;
      if (evidenceFiles && evidenceFiles.length > 0) {
        evidenceUrls = [];
        for (const file of evidenceFiles) {
          const result = await disputeApi.uploadEvidence(
            escrowId,
            file.uri,
            file.name,
            file.type,
          );
          evidenceUrls.push(result.url);
        }
      }

      // POST to the backend dispute endpoint.
      const { data } = await api.post(`/api/escrows/${escrowId}/dispute`, {
        reason: description || reason,
        evidence: evidenceUrls,
      });

      // Reconcile: replace the optimistic dispute with the server-created one.
      const serverDispute = mapBackendDispute(data);
      setDispute(serverDispute);

      return { success: true, dispute: serverDispute };
    } catch (error) {
      // Rollback optimistic state on failure.
      setDispute(undefined);

      const friendly = toFriendlyError(error);
      console.error('Failed to raise dispute:', friendly.message);
      return { success: false, error: friendly };
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  /**
   * Fetch the latest dispute status from the backend rather than relying on
   * stale local state. Called when the user re-opens an escrow detail page.
   */
  const refreshDispute = useCallback(async (escrowId: string) => {
    try {
      const { data } = await api.get(`/api/escrows/${escrowId}/dispute`);
      if (data) {
        const serverDispute = mapBackendDispute(data);
        setDispute(serverDispute);
        return serverDispute;
      } else {
        setDispute(undefined);
        return undefined;
      }
    } catch (error) {
      const friendly = toFriendlyError(error);
      // 404 means no dispute exists — not an error, just clear local state.
      if (friendly.title === 'Not found') {
        setDispute(undefined);
        return undefined;
      }
      console.error('Failed to fetch dispute:', friendly.message);
      return undefined;
    }
  }, []);

  const hasActiveDispute = dispute?.status === 'OPEN' || dispute?.status === 'UNDER_REVIEW';

  return {
    dispute,
    isSubmitting,
    raiseDispute,
    refreshDispute,
    hasActiveDispute,
  };
};
