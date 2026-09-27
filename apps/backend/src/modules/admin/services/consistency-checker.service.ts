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
import { EscrowChainIdService } from '../../escrow/services/escrow-chain-id.service';

@Injectable()
export class ConsistencyCheckerService {
  private readonly logger = new Logger(ConsistencyCheckerService.name);

  constructor(
    private readonly escrowService: EscrowService,
    private readonly sorobanClient: SorobanClientService,
    private readonly chainIds: EscrowChainIdService,
  ) {}

  async checkConsistency(
    request: ConsistencyCheckRequest,
  ): Promise<ConsistencyCheckResponse> {
    let escrowIds: string[] = [];
    if ('escrowIds' in request) {
      escrowIds = request.escrowIds.map(String);
    } else if ('fromId' in request && 'toId' in request) {
      const from = BigInt(request.fromId);
      const to = BigInt(request.toId);
      if (from > to || to - from >= 50n) {
        throw new Error('Invalid fromId/toId');
      }
      escrowIds = Array.from({ length: Number(to - from + 1n) }, (_, i) =>
        (from + BigInt(i)).toString(),
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
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            escrowId,
          );
        const mappingByUuid = isUuid
          ? await this.chainIds.findByEscrowId(escrowId)
          : null;
        const mappedId =
          mappingByUuid?.onChainId || (!isUuid ? escrowId : null);
        const dbId =
          mappingByUuid?.escrowId ||
          (mappedId ? await this.chainIds.findEscrowId(mappedId) : null);
        const dbEscrow = dbId
          ? await this.escrowService.findOne(dbId).catch(() => null)
          : null;
        const onchainEscrow = mappedId
          ? await this.sorobanClient.getEscrow(mappedId).catch(() => null)
          : null;
        const reportId = mappedId || escrowId;

        if (isUuid && (!mappingByUuid || !mappingByUuid.onChainId)) {
          reports.push({
            escrowId,
            isConsistent: false,
            fieldsMismatched: [],
            unmappedHistorical: true,
            error: 'Historical escrow has no verified chain ID mapping',
          });
          totalErrored++;
          continue;
        }

        if (!dbEscrow && !onchainEscrow) {
          reports.push({
            escrowId: reportId,
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
            escrowId: reportId,
            isConsistent: false,
            fieldsMismatched: [],
            missingInDb: true,
          });
          totalMissingInDb++;
          continue;
        }
        if (!onchainEscrow) {
          reports.push({
            escrowId: reportId,
            isConsistent: false,
            fieldsMismatched: [],
            missingOnChain: true,
          });
          totalMissingOnChain++;
          continue;
        }

        // Compare fields
        const mismatches = this.compareEscrow(dbEscrow, onchainEscrow);
        const isConsistent = mismatches.length === 0;
        if (!isConsistent) totalInconsistent++;
        reports.push({
          escrowId: reportId,
          isConsistent,
          fieldsMismatched: mismatches,
        });
      } catch (err) {
        this.logger.error(`Error checking escrow ${escrowId}: ${err}`);
        reports.push({
          escrowId,
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
      Active: 'active',
      Completed: 'completed',
      Cancelled: 'cancelled',
      Disputed: 'disputed',
      ArbiterResolved: 'completed',
    };
    return statusMap[contractStatus] || contractStatus.toLowerCase();
  }
}
