import { IEscrow } from '@/types/escrow';

export interface CreateEscrowPayload {
  title: string;
  description: string;
  amount: string;
  asset: string;
  counterpartyAddress: string;
  deadline: string;
}

/**
 * Creates an escrow via the backend API, then signs and submits
 * the resulting Stellar transaction envelope.
 */
export async function createEscrowWithTransaction(
  payload: CreateEscrowPayload,
  publicKey: string,
): Promise<IEscrow> {
  // 1. Create escrow record and get unsigned XDR from backend
  const res = await fetch('/api/escrows', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, creatorAddress: publicKey }),
  });
  if (!res.ok) throw new Error('Failed to create escrow');
  const { escrow, xdr } = await res.json();

  // 2. Sign the transaction via the injected wallet
  const { signedXDR } = await (window as any).freighter.signTransaction(xdr, {
    networkPassphrase: 'Test SDF Network ; September 2015',
  });

  // 3. Submit signed transaction
  const submitRes = await fetch(`/api/escrows/${escrow.id}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ signedXDR }),
  });
  if (!submitRes.ok) throw new Error('Failed to submit Stellar transaction');

  return escrow as IEscrow;
}