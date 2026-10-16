// frontend/src/lib/api/escrow.api.ts
import { api } from './transport';

export interface EscrowDetail {
    id: string;
    totalAmount: string;
    milestones: Array<{ id: string; amount: string; status: string }>;
    status: string;
}

export const escrowApi = {
    getDetail: async (escrowId: string): Promise<EscrowDetail> => {
        // Authenticated escrow request utilizing unified transport & Bearer token
        return api.get<EscrowDetail>(`/escrows/${escrowId}`);
    },

    submitAction: async (escrowId: string, payload: FormData | Record<string, any>): Promise<void> => {
        // Supports FormData multipart without forcing JSON headers, handles 204 No Content
        return api.post<void>(`/escrows/${escrowId}/actions`, payload);
    },
};