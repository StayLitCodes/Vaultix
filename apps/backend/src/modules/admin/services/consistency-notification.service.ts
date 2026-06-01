import { Injectable, Logger } from '@nestjs/common';
import { ConsistencySeverity } from '../entities/consistency-report.entity';

@Injectable()
export class ConsistencyNotificationService {
  private readonly logger = new Logger(ConsistencyNotificationService.name);

  async notifyAdmins(
    escrowId: string,
    severity: ConsistencySeverity,
    discrepancies: Array<{ field: string; dbValue: unknown; onchainValue: unknown }>,
  ): Promise<void> {
    if (severity !== ConsistencySeverity.CRITICAL) {
      return;
    }

    this.logger.warn(
      `CRITICAL consistency discrepancy detected for escrow ${escrowId}: ${JSON.stringify(discrepancies)}`,
    );

    // TODO: Integrate with email/SMS/Slack notification system
    // For MVP, we log the critical issue
  }
}
