import {
  IEscrow,
  IEscrowResponse,
  IEscrowFilters,
  IEscrowEvent,
  IEscrowEventResponse,
  IEscrowEventFilters,
} from "@/types/escrow";
import { EscrowService as ApiEscrowService } from "./escrow-api";

export class EscrowService {
  static async getEscrows(
    filters: IEscrowFilters = {},
  ): Promise<IEscrowResponse> {
    return await ApiEscrowService.getEscrows(filters);
  }

  static async getEvents(
    filters: IEscrowEventFilters = {},
  ): Promise<IEscrowEventResponse> {
    // If the underlying API expects a string (escrowId) instead of an object, handle it here:
    const param = filters.escrowId || (typeof filters === 'string' ? filters : '');
    return await (ApiEscrowService.getEvents as any)(param);
  }

  static async getEscrowById(id: string): Promise<IEscrow | null> {
    return await ApiEscrowService.getEscrowById(id);
  }

  static async createEscrow(data: Partial<IEscrow>): Promise<IEscrow> {
    return await ApiEscrowService.createEscrow(data);
  }

  static async updateEscrowStatus(
    id: string,
    status: IEscrow["status"],
  ): Promise<IEscrow | null> {
    return await ApiEscrowService.updateEscrowStatus(id, status);
  }

  static async fundEscrow(id: string, fundingData?: any): Promise<IEscrow> {
    if (typeof (ApiEscrowService as any).fundEscrow === 'function') {
      return await (ApiEscrowService as any).fundEscrow(id, fundingData);
    }
    const res = await ApiEscrowService.updateEscrowStatus(id, "funded");
    if (!res) throw new Error("Failed to fund escrow");
    return res;
  }

  static async releaseEscrow(id: string): Promise<IEscrow> {
    if (typeof (ApiEscrowService as any).releaseEscrow === 'function') {
      return await (ApiEscrowService as any).releaseEscrow(id);
    }
    const res = await ApiEscrowService.updateEscrowStatus(id, "released");
    if (!res) throw new Error("Failed to release escrow");
    return res;
  }

  static async cancelEscrow(id: string): Promise<IEscrow> {
    if (typeof (ApiEscrowService as any).cancelEscrow === 'function') {
      return await (ApiEscrowService as any).cancelEscrow(id);
    }
    const res = await ApiEscrowService.updateEscrowStatus(id, "cancelled");
    if (!res) throw new Error("Failed to cancel escrow");
    return res;
  }

  static async disputeEscrow(id: string, reason?: string): Promise<IEscrow> {
    if (typeof (ApiEscrowService as any).disputeEscrow === 'function') {
      return await (ApiEscrowService as any).disputeEscrow(id, reason);
    }
    const res = await ApiEscrowService.updateEscrowStatus(id, "disputed");
    if (!res) throw new Error("Failed to dispute escrow");
    return res;
  }
}