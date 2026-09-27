import { apiClient } from '@/lib/api-client';

export interface CreateEscrowPayload {
  title: string;
  description: string;
  category: string;
  amount: string;
  asset: string;
  counterpartyAddress: string;
  deadline: string;
  milestones: Array<{ description: string; amount: string }>;
  conditions: Array<{ type: string; description?: string; releaseDate?: string }>;
}

export interface PreparedEscrowCreation {
  intentId: string;
  chainEscrowId: string;
  unsignedXdr: string;
}

export interface SettledEscrowCreation {
  escrowId: string;
  transactionHash: string;
  status: 'confirmed';
}

/** Prepare an unsigned Soroban transaction for the currently selected wallet. */
export function prepareEscrowCreation(
  intentId: string,
  payload: CreateEscrowPayload,
): Promise<PreparedEscrowCreation> {
  return apiClient.post<PreparedEscrowCreation>('/escrows/creation-intents', {
    intentId,
    ...payload,
  });
}

/** Submit a signed envelope and wait for ledger confirmation. */
export function submitEscrowCreation(
  intentId: string,
  signedXdr: string,
): Promise<SettledEscrowCreation> {
  return apiClient.post<SettledEscrowCreation>(
    `/escrows/creation-intents/${encodeURIComponent(intentId)}/submit`,
    { signedXdr },
  );
}
