import { Injectable, Logger } from '@nestjs/common';
import {
  ConsistencyCheckRequest,
  ConsistencyCheckResponse,
  EscrowDiffReport,
  FieldMismatch,
} from '../dto/consistency-check.dto';
import { EscrowService } from '../../escrow/services/escrow.service';
import {
  SorobanClientService,
  OnchainEscrow,
} from '../../../services/stellar/soroban-client.service';
import { Escrow } from '../../escrow/entities/escrow.entity';

@Injectable()
export class ConsistencyCheckerService {
  private readonly logger = new Logger(ConsistencyCheckerService.name);

  constructor(
    private readonly escrowService: EscrowService,
    private readonly sorobanClient: SorobanClientService,
  ) {}

  async checkConsistency(
    request: ConsistencyCheckRequest,
  ): Promise<ConsistencyCheckResponse> {
    // ... (rest of the method logic remains similar, but using this.sorobanClient.getEscrow)
    // I'll replace the loop part below
    // 1. Resolve escrow IDs
    let escrowIds: string[] = [];
    if ('escrowIds' in request) {
      escrowIds = request.escrowIds.map(String);
    } else if ('fromId' in request && 'toId' in request) {
      const from = Number(request.fromId);
      const to = Number(request.toId);
      if (isNaN(from) || isNaN(to) || from > to) {
        throw new Error('Invalid fromId/toId');
      }
      escrowIds = Array.from({ length: to - from + 1 }, (_, i) =>
        String(from + i),
      );
    }
    // Limit batch size
    const MAX = 50;
    if (escrowIds.length > MAX) {
      throw new Error(`Max ${MAX} escrows per request`);
    }

    const reports: EscrowDiffReport[] = [];
    let totalInconsistent = 0,
      totalMissingInDb = 0,
      totalMissingOnChain = 0,
      totalErrored = 0;

    for (const escrowId of escrowIds) {
      try {
        // Fetch from DB
        let dbEscrow: unknown = null;
        try {
          dbEscrow = await this.escrowService.findOne(escrowId);
        } catch (error) {
          this.logger.warn(
            `Escrow ${escrowId} not found in DB: ${(error as Error).message}`,
          );
          dbEscrow = null;
        }
        // Fetch from on-chain (Soroban)
        let onchainEscrow: unknown = null;
        try {
          onchainEscrow = await this.sorobanClient.getEscrow(Number(escrowId));
        } catch (error) {
          this.logger.warn(
            `Escrow ${escrowId} not found on-chain: ${(error as Error).message}`,
          );
          onchainEscrow = null;
        }

        if (!dbEscrow && !onchainEscrow) {
          reports.push({
            escrowId: Number(escrowId),
            isConsistent: false,
            fieldsMismatched: [],
            missingInDb: true,
            missingOnChain: true,
          });
          totalMissingInDb++;
          totalMissingOnChain++;
          continue;
        }
        if (!dbEscrow) {
          reports.push({
            escrowId: Number(escrowId),
            isConsistent: false,
            fieldsMismatched: [],
            missingInDb: true,
          });
          totalMissingInDb++;
          continue;
        }
        if (!onchainEscrow) {
          reports.push({
            escrowId: Number(escrowId),
            isConsistent: false,
            fieldsMismatched: [],
            missingOnChain: true,
          });
          totalMissingOnChain++;
          continue;
        }

        // Compare fields
        const mismatches = this.compareEscrow(
          dbEscrow as Escrow,
          onchainEscrow as OnchainEscrow,
        );
        const isConsistent = mismatches.length === 0;
        if (!isConsistent) totalInconsistent++;
        reports.push({
          escrowId: Number(escrowId),
          isConsistent,
          fieldsMismatched: mismatches,
        });
      } catch (err) {
        this.logger.error(`Error checking escrow ${escrowId}: ${err}`);
        reports.push({
          escrowId: Number(escrowId),
          isConsistent: false,
          fieldsMismatched: [],
          error: String(err),
        });
        totalErrored++;
      }
    }

    return {
      reports,
      summary: {
        totalChecked: escrowIds.length,
        totalInconsistent,
        totalMissingInDb,
        totalMissingOnChain,
        totalErrored,
      },
    };
  }

  // Helper: compare two escrow objects and return diff
  compareEscrow(
    dbEscrow: Escrow,
    onchainEscrow: OnchainEscrow,
  ): FieldMismatch[] {
    const mismatches: FieldMismatch[] = [];

    // Compare Status (with mapping)
    const mappedOnchainStatus = this.mapContractStatus(onchainEscrow.status);
    if (mappedOnchainStatus !== (dbEscrow.status as string)) {
      mismatches.push({
        fieldName: 'status',
        dbValue: dbEscrow.status,
        onchainValue: onchainEscrow.status,
      });
    }

    // Compare Amount
    if (Number(onchainEscrow.amount) !== Number(dbEscrow.amount)) {
      mismatches.push({
        fieldName: 'amount',
        dbValue: dbEscrow.amount,
        onchainValue: onchainEscrow.amount,
      });
    }

    return mismatches;
  }

  private mapContractStatus(contractStatus: string): string {
    const statusMap: Record<string, string> = {
      Created: 'pending',
      Active: 'funded',
      Completed: 'completed',
      Cancelled: 'cancelled',
      Disputed: 'disputed',
      ArbiterResolved: 'completed',
    };
    return statusMap[contractStatus] || contractStatus.toLowerCase();
  }
}
