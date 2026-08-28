import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service';

@Injectable()
export class EscrowExpirySchedulerService {
  private readonly logger = new Logger(EscrowExpirySchedulerService.name);

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    private readonly stellarIntegrationService: EscrowStellarIntegrationService,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredFundedEscrows() {
    this.logger.log('Starting expired funded escrow refund process...');

    try {
      const now = new Date();

      const expiredEscrows = await this.escrowRepository.find({
        where: {
          status: EscrowStatus.ACTIVE,
          expiresAt: LessThan(now),
          isActive: true,
        },
        relations: ['creator', 'parties', 'parties.user'],
      });

      this.logger.log(
        `Found ${expiredEscrows.length} expired funded/active escrows`,
      );

      for (const escrow of expiredEscrows) {
        try {
          await this.processRefund(escrow);
        } catch (error) {
          this.logger.error(
            `Failed to process refund for escrow ${escrow.id}:`,
            error,
          );
        }
      }

      this.logger.log('Completed expired funded escrow refund process');
    } catch (error) {
      this.logger.error(
        'Error during expired funded escrow refund process:',
        error,
      );
    }
  }

  async processRefundById(escrowId: string) {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['creator', 'parties', 'parties.user'],
    });

    if (!escrow) {
      throw new Error(`Escrow ${escrowId} not found`);
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new Error(`Escrow ${escrowId} is not ACTIVE`);
    }

    await this.processRefund(escrow);
  }

  async processRefund(escrow: Escrow) {
    this.logger.log(
      `Processing refund for expired active escrow: ${escrow.id}`,
    );

    // Call refund on chain
    const txHash = await this.stellarIntegrationService.refundExpiredOnChain(
      escrow.id,
    );

    // Update status
    escrow.status = EscrowStatus.REFUNDED;
    escrow.isActive = false; // Mark as inactive since it's refunded
    await this.escrowRepository.save(escrow);

    // Send notifications to both parties
    this.notifyParties(escrow, 'ESCROW_REFUNDED', {
      reason: 'Escrow expired past deadline',
      txHash,
      refundedAt: new Date(),
    });

    // Log to audit log
    await this.adminAuditLogService.create({
      actorId: 'system',
      actionType: 'ESCROW_REFUND',
      resourceType: 'Escrow',
      resourceId: escrow.id,
      metadata: {
        reason: 'Expired while active/funded',
        txHash,
      },
    });

    this.logger.log(`Successfully refunded escrow: ${escrow.id}`);
  }

  private notifyParties(
    escrow: Escrow,
    eventType: string,
    data: Record<string, unknown>,
  ) {
    const notifications = escrow.parties.map((party) => ({
      walletAddress: party.user.walletAddress,
      type: eventType,
      data: {
        escrowId: escrow.id,
        escrowTitle: escrow.title,
        ...data,
      },
    }));

    this.logger.log(
      `Sending ${notifications.length} notifications for escrow ${escrow.id}`,
    );

    for (const notification of notifications) {
      try {
        this.sendWebhookNotification(notification);
      } catch (error) {
        this.logger.error(
          `Failed to send notification to ${notification.walletAddress}:`,
          error,
        );
      }
    }
  }

  private sendWebhookNotification(notification: Record<string, unknown>) {
    this.logger.log(
      `Sending webhook notification: ${JSON.stringify(notification)}`,
    );
  }
}
