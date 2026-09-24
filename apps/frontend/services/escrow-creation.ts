import { IEscrow } from "@/types/escrow";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const API_VERSION_PREFIX = "/v1";

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
  const res = await fetch(`${API_URL}${API_VERSION_PREFIX}/escrows`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, creatorAddress: publicKey }),
  });
  if (!res.ok) throw new Error("Failed to create escrow");
  const { escrow, xdr } = await res.json();

  // 2. Sign the transaction via the injected wallet
  const { signedXDR } = await (window as any).freighter.signTransaction(xdr, {
    networkPassphrase: "Test SDF Network ; September 2015",
  });

  // 3. Submit signed transaction
  const submitRes = await fetch(
    `${API_URL}${API_VERSION_PREFIX}/escrows/${escrow.id}/submit`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ signedXDR }),
    },
  );
  if (!submitRes.ok) throw new Error("Failed to submit Stellar transaction");

  return escrow as IEscrow;
}
