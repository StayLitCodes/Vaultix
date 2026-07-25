import axios from 'axios';
import {
  Escrow,
  EscrowFilters,
  EscrowListResponse,
  CreateEscrowPayload,
  ReleaseMilestonePayload,
} from '../types/escrow';
import { withRetry } from '../utils/retry';
import { Notification, NotificationsResponse } from '../types/notification';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  // Token would come from secure storage in production
  const token = (global as Record<string, unknown>).__authToken as string | undefined;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const escrowApi = {
  /** #314 – list escrows with status filter + pagination (auto-retry on testnet failures) */
  list: async (filters: EscrowFilters = {}): Promise<EscrowListResponse> => {
    return withRetry(async () => {
      const params: Record<string, string | number> = {
        page: filters.page ?? 1,
        limit: filters.limit ?? 20,
      };
      if (filters.status && filters.status !== 'all') params.status = filters.status;
      if (filters.search) params.search = filters.search;

      const { data } = await api.get<EscrowListResponse>('/api/escrows', { params });
      return data;
    }, { maxRetries: 2 });
  },

  /** #315 – get single escrow with milestones, parties, events (auto-retry) */
  getById: async (id: string): Promise<Escrow> => {
    return withRetry(async () => {
      const { data } = await api.get<Escrow>(`/api/escrows/${id}`);
      return data;
    }, { maxRetries: 3 });
  },

  /** #316 – create escrow (no auto-retry — user explicitly triggers this) */
  create: async (payload: CreateEscrowPayload): Promise<Escrow> => {
    const { data } = await api.post<Escrow>('/api/escrows', payload);
    return data;
  },

  /** #317 – release a milestone (no auto-retry — tx-sensitive, user controls retry) */
  releaseMilestone: async (payload: ReleaseMilestonePayload): Promise<{ txHash: string }> => {
    const { data } = await api.post<{ txHash: string }>(
      `/api/escrows/${payload.escrowId}/milestones/${payload.milestoneId}/release`,
    );
    return data;
  },

  /** #317 – poll transaction status (auto-retry with longer backoff) */
  getTxStatus: async (txHash: string): Promise<{ status: string; confirmed: boolean }> => {
    return withRetry(async () => {
      const { data } = await api.get<{ status: string; confirmed: boolean }>(
        `/api/transactions/${txHash}/status`,
      );
      return data;
    }, { maxRetries: 2, initialDelayMs: 2000 });
  },
};

interface InviteValidation {
  escrowId: string;
  role: string;
  sender: string;
  expiresAt: string;
}

export const inviteApi = {
  validateToken: async (token: string): Promise<InviteValidation> => {
    const { data } = await api.get<InviteValidation>(`/api/invites/${token}`);
    return data;
  },
  acceptInvitation: async (token: string): Promise<InviteValidation> => {
    const { data } = await api.post<InviteValidation>(`/api/invites/${token}/accept`);
    return data;
  },
};

export interface AppVersionResponse {
  minSupportedVersion: string;
  latestVersion: string;
  updateUrl: string;
}

export const versionApi = {
  /** #366 – check minimum supported and latest app versions */
  check: async (): Promise<AppVersionResponse> => {
    const { data } = await api.get<AppVersionResponse>('/api/app/version');
    return data;
  },
};

export const notificationApi = {
  /** Fetch user notifications */
  list: async (): Promise<NotificationsResponse> => {
    const { data } = await api.get<NotificationsResponse>('/api/notifications');
    return data;
  },

  /** Get unread notification count */
  getUnreadCount: async (): Promise<number> => {
    const { data } = await api.get<number>('/api/notifications/unread-count');
    return data;
  },

  /** Mark notification(s) as read */
  markAsRead: async (notificationId?: string): Promise<void> => {
    await api.post('/api/notifications/mark-as-read', { notificationId });
  },
};
export const disputeApi = {
  /** #409 — upload evidence file for a dispute, returns CID and URL */
  uploadEvidence: async (
    escrowId: string,
    fileUri: string,
    fileName: string,
    mimeType: string,
  ): Promise<{ cid: string; url: string }> => {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    const { data } = await api.post<{ cid: string; url: string }>(
      `/api/escrows/${escrowId}/evidence`,
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      },
    );
    return data;
  },
};