import {
  IEscrow,
  IEscrowResponse,
  IEscrowFilters,
  IEscrowEvent,
  IEscrowEventResponse,
  IEscrowEventFilters
} from '@/types/escrow';
import { apiClient } from '@/lib/api-client';

/**
 * Real EscrowService - connects to backend API
 * Replace the mock service in services/escrow.ts with this implementation
 */
export class EscrowService {
  static async getEscrows(filters: IEscrowFilters = {}): Promise<IEscrowResponse> {
    const params = new URLSearchParams();
    
    if (filters.status && filters.status !== 'all') {
      params.set('status', filters.status);
    }
    if (filters.search) {
      params.set('search', filters.search);
    }
    if (filters.page) {
      params.set('page', String(filters.page));
    }
    if (filters.limit) {
      params.set('limit', String(filters.limit));
    }
    if (filters.sortBy) {
      params.set('sortBy', filters.sortBy);
    }
    if (filters.sortOrder) {
      params.set('sortOrder', filters.sortOrder);
    }

    const queryString = params.toString();
    return apiClient.get<IEscrowResponse>(`/escrows${queryString ? `?${queryString}` : ''}`);
  }

  static async getEscrowById(id: string): Promise<IEscrow> {
    return apiClient.get<IEscrow>(`/escrows/${id}`);
  }

  static async createEscrow(data: any): Promise<IEscrow> {
    return apiClient.post<IEscrow>('/escrows', data);
  }

  static async fundEscrow(id: string, data: { amount: string; asset: string }): Promise<IEscrow> {
    return apiClient.post<IEscrow>(`/escrows/${id}/fund`, data);
  }

  static async releaseFunds(id: string): Promise<IEscrow> {
    return apiClient.post<IEscrow>(`/escrows/${id}/release`);
  }

  static async cancelEscrow(id: string, reason?: string): Promise<IEscrow> {
    return apiClient.post<IEscrow>(`/escrows/${id}/cancel`, { reason });
  }

  static async fileDispute(id: string, data: { reason: string; description?: string }): Promise<IEscrow> {
    return apiClient.post<IEscrow>(`/escrows/${id}/dispute`, data);
  }

  static async fulfillCondition(
    escrowId: string, 
    conditionId: string, 
    data: { notes?: string; evidence?: string }
  ): Promise<IEscrow> {
    return apiClient.post<IEscrow>(
      `/escrows/${escrowId}/conditions/${conditionId}/fulfill`,
      data
    );
  }

  static async confirmCondition(escrowId: string, conditionId: string): Promise<IEscrow> {
    return apiClient.post<IEscrow>(
      `/escrows/${escrowId}/conditions/${conditionId}/confirm`
    );
  }

  static async getEvents(
    escrowId: string, 
    filters: IEscrowEventFilters = {}
  ): Promise<IEscrowEventResponse> {
    const params = new URLSearchParams();
    
    if (filters.page) {
      params.set('page', String(filters.page));
    }
    if (filters.limit) {
      params.set('limit', String(filters.limit));
    }
    if (filters.eventType && filters.eventType !== 'ALL') {
      params.set('eventType', filters.eventType);
    }

    const queryString = params.toString();
    return apiClient.get<IEscrowEventResponse>(
      `/escrows/${escrowId}/events${queryString ? `?${queryString}` : ''}`
    );
  }

  static async updateEscrowStatus(id: string, status: IEscrow['status']): Promise<IEscrow> {
    // This would depend on your backend API structure
    // You might need separate endpoints for each status transition
    switch (status) {
      case 'funded':
        return this.fundEscrow(id, { amount: '0', asset: 'XLM' });
      case 'released':
        return this.releaseFunds(id);
      case 'cancelled':
        return this.cancelEscrow(id);
      default:
        throw new Error(`Status transition to ${status} not supported`);
    }
  }
}
