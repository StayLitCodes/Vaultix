// frontend/src/lib/api/services.api.ts
import { api } from './transport';

export interface EscrowDetail {
    id: string;
    totalAmount: string;
    milestones: Array<{ id: string; amount: string; status: string }>;
    status: string;
}

export interface NotificationPreference {
    emailEnabled: boolean;
    pushEnabled: boolean;
}

export const escrowApi = {
    getDetail: async (escrowId: string): Promise<EscrowDetail> => {
        // Authenticated escrow request ensuring Bearer token is attached
        return api.get<EscrowDetail>(`/escrows/${escrowId}`);
    },

    submitAction: async (escrowId: string, payload: FormData | Record<string, any>): Promise<void> => {
        // Supports multipart FormData without forcing JSON headers, handles 204 responses
        return api.post<void>(`/escrows/${escrowId}/actions`, payload);
    },
};

export const adminApi = {
    getMetrics: async (): Promise<any> => {
        return api.get<any>('/admin/metrics');
    },
};

export const assetApi = {
    uploadAsset: async (formData: FormData): Promise<any> => {
        // Multipart asset upload without forcing JSON content-type
        return api.post<any>('/assets/upload', formData);
    },
};

export const notificationApi = {
    getPreferences: async (): Promise<NotificationPreference> => {
        return api.get<NotificationPreference>('/notifications/preferences');
    },
};