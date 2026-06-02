import axios from 'axios';
import {
  Escrow,
  EscrowFilters,
  EscrowListResponse,
  CreateEscrowPayload,
  ReleaseMilestonePayload,
} from '../types/escrow';
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
  /** #314 – list escrows with status filter + pagination */
  list: async (filters: EscrowFilters = {}): Promise<EscrowListResponse> => {
    const params: Record<string, string | number> = {
      page: filters.page ?? 1,
      limit: filters.limit ?? 20,
    };
    if (filters.status && filters.status !== 'all') params.status = filters.status;
    if (filters.search) params.search = filters.search;

    const { data } = await api.get<EscrowListResponse>('/api/escrows', { params });
    return data;
  },

  /** #315 – get single escrow with milestones, parties, events */
  getById: async (id: string): Promise<Escrow> => {
    const { data } = await api.get<Escrow>(`/api/escrows/${id}`);
    return data;
  },

  /** #316 – create escrow */
  create: async (payload: CreateEscrowPayload): Promise<Escrow> => {
    const { data } = await api.post<Escrow>('/api/escrows', payload);
    return data;
  },

  /** #317 – release a milestone */
  releaseMilestone: async (payload: ReleaseMilestonePayload): Promise<{ txHash: string }> => {
    const { data } = await api.post<{ txHash: string }>(
      `/api/escrows/${payload.escrowId}/milestones/${payload.milestoneId}/release`,
    );
    return data;
  },

  /** #317 – poll transaction status */
  getTxStatus: async (txHash: string): Promise<{ status: string; confirmed: boolean }> => {
    const { data } = await api.get<{ status: string; confirmed: boolean }>(
      `/api/transactions/${txHash}/status`,
    );
    return data;
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
