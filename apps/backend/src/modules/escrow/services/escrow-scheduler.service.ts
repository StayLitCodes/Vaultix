import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, In, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { EscrowService } from './escrow.service';

@Injectable()
export class EscrowSchedulerService {
  private readonly logger = new Logger(EscrowSchedulerService.name);

  constructor(
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(EscrowEvent)
    private escrowEventRepository: Repository<EscrowEvent>,
    private escrowService: EscrowService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredEscrows() {
    this.logger.log('Starting expired escrow processing...');

    try {
      await this.processExpiredPendingEscrows();
      await this.processExpiredActiveEscrows();

      this.logger.log('Completed expired escrow processing');
    } catch (error) {
      this.logger.error('Error processing expired escrows:', error);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendExpirationWarnings() {
    this.logger.log('Sending 24-hour expiration warnings...');

    try {
      await this.processExpirationWarnings();
      this.logger.log('Completed expiration warnings');
    } catch (error) {
      this.logger.error('Error sending expiration warnings:', error);
    }
  }

  private async processExpiredPendingEscrows() {
    const now = new Date();

    const expiredPendingEscrows = await this.escrowRepository.find({
      where: {
        status: EscrowStatus.PENDING,
        expiresAt: LessThan(now),
        isActive: true,
      },
      relations: ['creator', 'parties', 'parties.user'],
    });

    this.logger.log(
      `Found ${expiredPendingEscrows.length} expired pending escrows`,
    );

    for (const escrow of expiredPendingEscrows) {
      try {
        await this.autoCancelEscrow(escrow);
      } catch (error) {
        this.logger.error(`Failed to auto-cancel escrow ${escrow.id}:`, error);
      }
    }
  }

  private async processExpiredActiveEscrows() {
    const now = new Date();

    const expiredActiveEscrows = await this.escrowRepository.find({
      where: {
        status: EscrowStatus.ACTIVE,
        expiresAt: LessThan(now),
        isActive: true,
      },
      relations: ['creator', 'parties', 'parties.user'],
    });

    this.logger.log(
      `Found ${expiredActiveEscrows.length} expired active escrows`,
    );

    for (const escrow of expiredActiveEscrows) {
      try {
        await this.escalateToDispute(escrow);
      } catch (error) {
        this.logger.error(
          `Failed to escalate escrow ${escrow.id} to dispute:`,
          error,
        );
      }
    }
  }

  private async processExpirationWarnings() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const warningThreshold = new Date();
    warningThreshold.setDate(warningThreshold.getDate() + 1);
    warningThreshold.setHours(0, 0, 0, 0);

    const escrowsNeedingWarning = await this.escrowRepository.find({
      where: {
        status: In([EscrowStatus.PENDING, EscrowStatus.ACTIVE]),
        expiresAt: LessThan(warningThreshold),
        expirationNotifiedAt: IsNull(),
        isActive: true,
      },
      relations: ['creator', 'parties', 'parties.user'],
    });

    this.logger.log(
      `Found ${escrowsNeedingWarning.length} escrows needing expiration warnings`,
    );

    for (const escrow of escrowsNeedingWarning) {
      try {
        await this.sendExpirationWarning(escrow);
      } catch (error) {
        this.logger.error(
          `Failed to send warning for escrow ${escrow.id}:`,
          error,
        );
      }
    }
  }

  private async autoCancelEscrow(escrow: Escrow) {
    this.logger.log(`Auto-canceling expired pending escrow: ${escrow.id}`);

    escrow.status = EscrowStatus.CANCELLED;
    escrow.isActive = false;

    await this.escrowRepository.save(escrow);

    await this.escrowEventRepository.save({
      escrow: { id: escrow.id },
      type: 'AUTO_CANCELLED',
      data: {
        reason: 'EXPIRED_PENDING',
        expiredAt: escrow.expiresAt,
        processedAt: new Date(),
      },
    });

    void this.notifyParties(escrow, 'ESCROW_AUTO_CANCELLED', {
      reason: 'Escrow expired while pending',
      expiredAt: escrow.expiresAt,
    });

    this.logger.log(`Successfully auto-cancelled escrow: ${escrow.id}`);
  }

  private async escalateToDispute(escrow: Escrow) {
    this.logger.log(
      `Escalating expired active escrow to dispute: ${escrow.id}`,
    );

    escrow.status = EscrowStatus.DISPUTED;

    await this.escrowRepository.save(escrow);

    await this.escrowEventRepository.save({
      escrow: { id: escrow.id },
      type: 'AUTO_ESCALATED_TO_DISPUTE',
      data: {
        reason: 'EXPIRED_ACTIVE',
        expiredAt: escrow.expiresAt,
        processedAt: new Date(),
      },
    });

    void this.notifyParties(escrow, 'ESCROW_ESCALATED_TO_DISPUTE', {
      reason: 'Escrow expired while active',
      expiredAt: escrow.expiresAt,
      requiresArbitration: true,
    });

    this.logger.log(`Successfully escalated escrow to dispute: ${escrow.id}`);
  }

  private async sendExpirationWarning(escrow: Escrow) {
    this.logger.log(`Sending expiration warning for escrow: ${escrow.id}`);

    escrow.expirationNotifiedAt = new Date();
    await this.escrowRepository.save(escrow);

    await this.escrowEventRepository.save({
      escrow: { id: escrow.id },
      type: 'EXPIRATION_WARNING_SENT',
      data: {
        expiresAt: escrow.expiresAt,
        warnedAt: new Date(),
      },
    });

    void this.notifyParties(escrow, 'ESCROW_EXPIRING_SOON', {
      expiresAt: escrow.expiresAt,
      hoursUntilExpiry: this.getHoursUntilExpiry(escrow.expiresAt!),
    });

    this.logger.log(
      `Successfully sent expiration warning for escrow: ${escrow.id}`,
    );
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
        void this.sendWebhookNotification(notification);
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

  private getHoursUntilExpiry(expiresAt: Date): number {
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  }

  async processEscrowManually(escrowId: string): Promise<void> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['creator', 'parties', 'parties.user'],
    });

    if (!escrow) {
      throw new Error(`Escrow not found: ${escrowId}`);
    }

    if (!escrow.expiresAt) {
      throw new Error(`Escrow ${escrowId} has no expiration date`);
    }

    const now = new Date();
    if (escrow.expiresAt > now) {
      throw new Error(`Escrow ${escrowId} has not expired yet`);
    }

    if (escrow.status === EscrowStatus.PENDING) {
      await this.autoCancelEscrow(escrow);
    } else if (escrow.status === EscrowStatus.ACTIVE) {
      await this.escalateToDispute(escrow);
    } else {
      this.logger.log(
        `Escrow ${escrowId} already processed with status: ${escrow.status}`,
      );
    }
  }
}
