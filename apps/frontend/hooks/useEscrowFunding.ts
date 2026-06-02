import { useState } from 'react';

export interface FundingState {
  loading: boolean;
  error: string | null;
  txHash: string | null;
}

/**
 * Hook for signing and submitting a Stellar payment transaction to fund an escrow.
 * Calls the wallet's signTransaction method and submits to the backend.
 */
export const useEscrowFunding = () => {
  const [state, setState] = useState<FundingState>({
    loading: false,
    error: null,
    txHash: null,
  });

  const fundEscrow = async (escrowId: string, xdr: string): Promise<boolean> => {
    setState({ loading: true, error: null, txHash: null });
    try {
      // Sign the XDR envelope via the injected wallet
      const { signedXDR } = await (window as any).freighter.signTransaction(xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });

      const res = await fetch(`/api/escrows/${escrowId}/fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedXDR }),
      });

      if (!res.ok) throw new Error('Funding submission failed');
      const { txHash } = await res.json();
      setState({ loading: false, error: null, txHash });
      return true;
    } catch (err: any) {
      setState({ loading: false, error: err.message ?? 'Unknown error', txHash: null });
      return false;
    }
  };

  return { ...state, fundEscrow };
};