import {
  IEscrow,
  IEscrowResponse,
  IEscrowFilters,
  IEscrowEvent,
  IEscrowEventResponse,
  IEscrowEventFilters,
  RawEscrow,
  RawEscrowResponse
} from '@/types/escrow';
import { apiClient } from '@/lib/api-client';
import {
  normalizeEscrowStatus,
  toBackendEscrowStatus,
  CanonicalEscrowStatus,
} from '@/utils/escrowStatus';

/**
 * Applies the canonical status normalizer to a single wire-shaped escrow.
 * This is the one place API status values become typed.
 */
function withNormalizedStatus(escrow: RawEscrow): IEscrow {
  return { ...escrow, status: normalizeEscrowStatus(escrow.status) };
}

/**
 * Real EscrowService - connects to backend API
 * Replace the mock service in services/escrow.ts with this implementation
 */
export class EscrowService {
  static async getEscrows(filters: IEscrowFilters = {}): Promise<IEscrowResponse> {
    const params = new URLSearchParams();
    
    if (filters.status && filters.status !== 'all') {
      // Accept either a canonical status or a raw backend value, and always
      // send the backend wire value. An unknown status has no counterpart and
      // is omitted rather than sent as a filter the backend would reject.
      const wireStatus = toBackendEscrowStatus(
        normalizeEscrowStatus(filters.status)
      );
      if (wireStatus) {
        params.set('status', wireStatus);
      }
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
    const response = await apiClient.get<RawEscrowResponse>(
      `/escrows${queryString ? `?${queryString}` : ''}`
    );
    return {
      ...response,
      escrows: response.escrows.map(withNormalizedStatus),
    };
  }

  static async getEscrowById(id: string): Promise<IEscrow> {
    return withNormalizedStatus(
      await apiClient.get<RawEscrow>(`/escrows/${id}`)
    );
  }

  static async createEscrow(data: any): Promise<IEscrow> {
    return withNormalizedStatus(await apiClient.post<RawEscrow>('/escrows', data));
  }

  static async fundEscrow(id: string, data: { amount: string; asset: string }): Promise<IEscrow> {
    return withNormalizedStatus(
      await apiClient.post<RawEscrow>(`/escrows/${id}/fund`, data)
    );
  }

  static async releaseFunds(id: string): Promise<IEscrow> {
    return withNormalizedStatus(
      await apiClient.post<RawEscrow>(`/escrows/${id}/release`)
    );
  }

  static async cancelEscrow(id: string, reason?: string): Promise<IEscrow> {
    return withNormalizedStatus(
      await apiClient.post<RawEscrow>(`/escrows/${id}/cancel`, { reason })
    );
  }

  static async fileDispute(id: string, data: { reason: string; description?: string }): Promise<IEscrow> {
    return withNormalizedStatus(
      await apiClient.post<RawEscrow>(`/escrows/${id}/dispute`, data)
    );
  }

  static async fulfillCondition(
    escrowId: string, 
    conditionId: string, 
    data: { notes?: string; evidence?: string }
  ): Promise<IEscrow> {
    return withNormalizedStatus(
      await apiClient.post<RawEscrow>(
        `/escrows/${escrowId}/conditions/${conditionId}/fulfill`,
        data
      )
    );
  }

  static async confirmCondition(escrowId: string, conditionId: string): Promise<IEscrow> {
    return withNormalizedStatus(
      await apiClient.post<RawEscrow>(
        `/escrows/${escrowId}/conditions/${conditionId}/confirm`
      )
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
    // Generic status transitions are only supported where a dedicated endpoint
    // exists. Funding, release and cancel have their own endpoints; anything
    // else (notably "disputed") must go through its dedicated action instead of
    // a fabricated status mutation.
    switch (status) {
      // 'released' normalizes to COMPLETED, so the canonical constant covers
      // both spellings. FUNDED is deliberately absent: funding has its own
      // endpoint that takes a real amount, and routing it through here would
      // fabricate a zero-value deposit.
      case CanonicalEscrowStatus.COMPLETED:
        return this.releaseFunds(id);
      case CanonicalEscrowStatus.CANCELLED:
        return this.cancelEscrow(id);
      default:
        throw new Error(`Status transition to ${status} not supported`);
    }
  }
}
