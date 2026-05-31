import { useState } from 'react';

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
}

export const useDisputes = (initialDispute?: DisputeDetails) => {
  const [dispute, setDispute] = useState<DisputeDetails | undefined>(initialDispute);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const raiseDispute = async (escrowId: string, reason: string, description: string) => {
    setIsSubmitting(true);
    try {
      // Stub API Call
      await new Promise(res => setTimeout(res, 1000));
      
      const newDispute: DisputeDetails = {
        id: `disp_${Date.now()}`,
        escrowId,
        reason,
        description,
        status: 'OPEN',
      };
      
      setDispute(newDispute);
      return { success: true };
    } catch (error) {
      console.error('Failed to raise dispute', error);
      return { success: false, error };
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasActiveDispute = dispute?.status === 'OPEN' || dispute?.status === 'UNDER_REVIEW';

  return {
    dispute,
    isSubmitting,
    raiseDispute,
    hasActiveDispute,
  };
};
