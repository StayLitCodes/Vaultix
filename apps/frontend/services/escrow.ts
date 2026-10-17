import {
  IEscrow,
  IEscrowResponse,
  IEscrowFilters,
  IEscrowEvent,
  IEscrowEventResponse,
  IEscrowEventFilters,
} from "@/types/escrow";
import { EscrowService as ApiEscrowService } from "./escrow-api";

/** Payload accepted by the dispute endpoint. */
export interface DisputeEscrowPayload {
  reason: string;
  description?: string;
  evidence?: string[];
}

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

  static async fundEscrow(
    id: string,
    fundingData: { amount: string; asset: string },
  ): Promise<IEscrow> {
    return await ApiEscrowService.fundEscrow(id, fundingData);
  }

  /**
   * Releases escrow funds via the dedicated release endpoint. The API class
   * exposes `releaseFunds`, so it is called directly instead of probing for a
   * non-existent `releaseEscrow` and falling back to a status mutation. The
   * release endpoint takes no request body.
   */
  static async releaseEscrow(id: string): Promise<IEscrow> {
    return await ApiEscrowService.releaseFunds(id);
  }

  static async cancelEscrow(id: string, reason?: string): Promise<IEscrow> {
    return await ApiEscrowService.cancelEscrow(id, reason);
  }

  /**
   * Files a dispute via the dedicated dispute endpoint. The API class exposes
   * `fileDispute`, so it is called directly. The old fallback asked
   * `updateEscrowStatus` for a "disputed" transition that it explicitly did
   * not support, which always threw; there is no status-mutation path here.
   * The reason and evidence payload is preserved and sent to the endpoint.
   */
  static async disputeEscrow(
    id: string,
    payload: DisputeEscrowPayload,
  ): Promise<IEscrow> {
    return await ApiEscrowService.fileDispute(id, payload);
  }
}
