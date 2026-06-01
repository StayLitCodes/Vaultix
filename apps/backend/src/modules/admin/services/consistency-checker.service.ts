import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
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
import { Escrow, EscrowStatus } from '../../escrow/entities/escrow.entity';
import { ConsistencyReport, ConsistencySeverity } from '../entities/consistency-report.entity';
import { AdminAuditLogService } from './admin-audit-log.service';
import { ConsistencyNotificationService } from './consistency-notification.service';

@Injectable()
export class ConsistencyCheckerService {
  private readonly logger = new Logger(ConsistencyCheckerService.name);

  constructor(
    private readonly escrowService: EscrowService,
    private readonly sorobanClient: SorobanClientService,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(ConsistencyReport)
    private readonly reportRepository: Repository<ConsistencyReport>,
    private readonly auditLogService: AdminAuditLogService,
    private readonly notificationService: ConsistencyNotificationService,
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
        if (!isConsistent) {
          totalInconsistent++;
          await this.saveReport(escrowId, mismatches);
        }
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

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async runDailyConsistencyCheck(): Promise<void> {
    this.logger.log('Starting daily consistency check for all ACTIVE escrows');
    try {
      const activeEscrows = await this.escrowRepository.find({
        where: { status: EscrowStatus.ACTIVE },
      });
      const escrowIds = activeEscrows.map((e) => e.id);
      if (escrowIds.length > 0) {
        await this.checkConsistency({ escrowIds });
      }
      this.logger.log(`Daily consistency check completed for ${escrowIds.length} escrows`);
    } catch (error) {
      this.logger.error(`Daily consistency check failed: ${error}`);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async checkStaleEscrows(): Promise<void> {
    this.logger.log('Checking for stale escrows (no update in 24h)');
    try {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const staleEscrows = await this.escrowRepository.find({
        where: {
          status: EscrowStatus.ACTIVE,
          updatedAt: LessThan(twentyFourHoursAgo),
        },
      });
      if (staleEscrows.length > 0) {
        const escrowIds = staleEscrows.map((e) => e.id);
        await this.checkConsistency({ escrowIds });
        this.logger.log(`Checked ${escrowIds.length} stale escrows`);
      }
    } catch (error) {
      this.logger.error(`Stale escrow check failed: ${error}`);
    }
  }

  async getDetailedComparison(escrowId: string): Promise<{
    escrowId: string;
    database: Partial<Escrow>;
    onchain: OnchainEscrow | null;
    discrepancies: FieldMismatch[];
  }> {
    const dbEscrow = await this.escrowService.findOne(escrowId);
    const onchainEscrow = await this.sorobanClient.getEscrow(Number(escrowId));
    const discrepancies = onchainEscrow ? this.compareEscrow(dbEscrow, onchainEscrow) : [];

    return {
      escrowId,
      database: {
        id: dbEscrow.id,
        status: dbEscrow.status,
        amount: dbEscrow.amount,
        assetCode: dbEscrow.assetCode,
        creatorId: dbEscrow.creatorId,
        updatedAt: dbEscrow.updatedAt,
      },
      onchain: onchainEscrow,
      discrepancies,
    };
  }

  async getReports(filters: {
    severity?: ConsistencySeverity;
    resolved?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ data: ConsistencyReport[]; total: number }> {
    const { severity, resolved, page = 1, limit = 20 } = filters;
    const where: any = {};
    if (severity) where.severity = severity;
    if (resolved !== undefined) where.resolved = resolved;

    const [data, total] = await this.reportRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total };
  }

  async resolveDiscrepancy(
    escrowId: string,
    adminUserId: string,
    syncToOnchain: boolean,
  ): Promise<void> {
    const onchainEscrow = await this.sorobanClient.getEscrow(Number(escrowId));
    if (!onchainEscrow) {
      throw new Error('Escrow not found on-chain');
    }

    if (syncToOnchain) {
      const mappedStatus = this.mapContractStatus(onchainEscrow.status);
      await this.escrowRepository.update(escrowId, {
        status: mappedStatus as EscrowStatus,
        amount: Number(onchainEscrow.amount),
      });
    }

    await this.reportRepository.update(
      { escrowId, resolved: false },
      { resolved: true, resolvedByUserId: adminUserId, resolvedAt: new Date() },
    );

    await this.auditLogService.create({
      actorId: adminUserId,
      actionType: 'consistency_resolved',
      resourceType: 'escrow',
      resourceId: escrowId,
      metadata: { syncToOnchain, onchainState: onchainEscrow },
    });

    this.logger.log(`Resolved consistency discrepancy for escrow ${escrowId}`);
  }

  private compareEscrow(
    dbEscrow: Escrow,
    onchainEscrow: OnchainEscrow,
  ): FieldMismatch[] {
    const mismatches: FieldMismatch[] = [];

    const mappedOnchainStatus = this.mapContractStatus(onchainEscrow.status);
    if (mappedOnchainStatus !== (dbEscrow.status as string)) {
      mismatches.push({
        fieldName: 'status',
        dbValue: dbEscrow.status,
        onchainValue: onchainEscrow.status,
      });
    }

    if (Number(onchainEscrow.amount) !== Number(dbEscrow.amount)) {
      mismatches.push({
        fieldName: 'amount',
        dbValue: dbEscrow.amount,
        onchainValue: onchainEscrow.amount,
      });
    }

    if (onchainEscrow.depositor && dbEscrow.creatorId !== onchainEscrow.depositor) {
      mismatches.push({
        fieldName: 'depositor',
        dbValue: dbEscrow.creatorId,
        onchainValue: onchainEscrow.depositor,
      });
    }

    return mismatches;
  }

  private async saveReport(
    escrowId: string,
    mismatches: FieldMismatch[],
  ): Promise<void> {
    if (mismatches.length === 0) return;

    const severity = this.determineSeverity(mismatches);
    const discrepancies = mismatches.map((m) => ({
      field: m.fieldName,
      dbValue: m.dbValue,
      onchainValue: m.onchainValue,
    }));

    const report = this.reportRepository.create({
      escrowId,
      severity,
      discrepancies,
    });

    await this.reportRepository.save(report);
    await this.notificationService.notifyAdmins(escrowId, severity, discrepancies);
  }

  private determineSeverity(mismatches: FieldMismatch[]): ConsistencySeverity {
    const criticalFields = ['status', 'amount'];
    const hasCritical = mismatches.some((m) => criticalFields.includes(m.fieldName));
    return hasCritical ? ConsistencySeverity.CRITICAL : ConsistencySeverity.WARNING;
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
