import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  Between,
  In,
  IsNull,
  LessThan,
} from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { EscrowService } from './escrow.service';
import { NotificationService } from '../../../notifications/notifications.service';
import { NotificationEventType } from '../../../notifications/enums/notification-event.enum';

type WarningField =
  | 'expirationWarning24hSentAt'
  | 'expirationWarning1hSentAt';

@Injectable()
export class EscrowSchedulerService {
  private readonly logger = new Logger(EscrowSchedulerService.name);
  private readonly warningHours = parseInt(
    process.env.ESCROW_WARNING_HOURS || '24',
    10,
  );
  private readonly urgentWarningHours = parseInt(
    process.env.ESCROW_URGENT_WARNING_HOURS || '1',
    10,
  );
  private readonly refundMaxRetries = parseInt(
    process.env.ESCROW_REFUND_MAX_RETRIES || '3',
    10,
  );
  private readonly batchSize = 50;
  private readonly hourMs = 1000 * 60 * 60;

  constructor(
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(EscrowEvent)
    private escrowEventRepository: Repository<EscrowEvent>,
    private escrowService: EscrowService,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredEscrows() {
    this.logger.log('Starting expired escrow processing...');

    try {
      await this.processExpiredEscrows();
      this.logger.log('Completed expired escrow processing');
    } catch (error) {
      this.logger.error('Error processing expired escrows:', error);
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async sendExpirationWarnings() {
    this.logger.log('Starting expiration warning processing...');

    try {
      await this.processExpirationWarnings();
      this.logger.log('Completed expiration warning processing');
    } catch (error) {
      this.logger.error('Error sending expiration warnings:', error);
    }
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async processExpiredEscrowRefunds() {
    this.logger.log('Starting expired escrow refund processing...');

    try {
      await this.processRefundableEscrows();
      this.logger.log('Completed expired escrow refund processing');
    } catch (error) {
      this.logger.error('Error processing expired escrow refunds:', error);
    }
  }

  private async processExpiredEscrows() {
    await Promise.all([
      this.processExpiredEscrowsByStatus(
        EscrowStatus.PENDING,
        'Expired while pending',
      ),
      this.processExpiredEscrowsByStatus(
        EscrowStatus.ACTIVE,
        'Expired while active',
      ),
    ]);
  }

  private async processExpiredEscrowsByStatus(
    status: EscrowStatus,
    reason: string,
  ) {
    const now = new Date();

    while (true) {
      const expiredEscrows = await this.escrowRepository.find({
        where: {
          status,
          expiresAt: LessThan(now),
          isActive: true,
        },
        relations: ['creator', 'parties', 'parties.user'],
        take: this.batchSize,
        order: { expiresAt: 'ASC' },
      });

      if (expiredEscrows.length === 0) {
        break;
      }

      this.logger.log(
        `Found ${expiredEscrows.length} expired ${status} escrows to process`,
      );

      for (const escrow of expiredEscrows) {
        try {
          await this.expireEscrow(escrow, reason);
        } catch (error) {
          this.logger.error(
            `Failed to expire escrow ${escrow.id}:`,
            error,
          );
        }
      }

      if (expiredEscrows.length < this.batchSize) {
        break;
      }
    }
  }

  private async processExpirationWarnings() {
    await this.processWarningWindow(
      this.warningHours,
      'expirationWarning24hSentAt',
      '24h',
    );
    await this.processWarningWindow(
      this.urgentWarningHours,
      'expirationWarning1hSentAt',
      '1h',
    );
  }

  private async processWarningWindow(
    hours: number,
    warningField: WarningField,
    warningLabel: string,
  ) {
    const now = new Date();
    const lowerBound = new Date(now.getTime() + hours * this.hourMs);
    const upperBound = new Date(now.getTime() + (hours + 1) * this.hourMs);

    const where: any = {
      status: In([EscrowStatus.PENDING, EscrowStatus.ACTIVE]),
      expiresAt: Between(lowerBound, upperBound),
      isActive: true,
    };
    where[warningField] = IsNull();

    while (true) {
      const escrowsNeedingWarning = await this.escrowRepository.find({
        where,
        relations: ['creator', 'parties', 'parties.user'],
        take: this.batchSize,
        order: { expiresAt: 'ASC' },
      });

      if (escrowsNeedingWarning.length === 0) {
        break;
      }

      this.logger.log(
        `Found ${escrowsNeedingWarning.length} escrows needing ${warningLabel} warning`,
      );

      for (const escrow of escrowsNeedingWarning) {
        try {
          await this.sendExpirationWarning(escrow, warningField, warningLabel);
        } catch (error) {
          this.logger.error(
            `Failed to send ${warningLabel} warning for escrow ${escrow.id}:`,
            error,
          );
        }
      }

      if (escrowsNeedingWarning.length < this.batchSize) {
        break;
      }
    }
  }

  private async processRefundableEscrows() {
    while (true) {
      const expiredEscrows = await this.escrowRepository.find({
        where: {
          status: EscrowStatus.EXPIRED,
          refundTransactionHash: IsNull(),
          refundRetryCount: LessThan(this.refundMaxRetries),
        },
        relations: ['creator', 'parties', 'parties.user'],
        take: this.batchSize,
        order: { expiresAt: 'ASC' },
      });

      if (expiredEscrows.length === 0) {
        break;
      }

      this.logger.log(
        `Found ${expiredEscrows.length} expired escrows ready for refund`,
      );

      for (const escrow of expiredEscrows) {
        try {
          await this.escrowService.refundExpiredEscrow(escrow.id);
        } catch (error) {
          this.logger.error(
            `Failed to refund expired escrow ${escrow.id}:`,
            error,
          );
        }
      }

      if (expiredEscrows.length < this.batchSize) {
        break;
      }
    }
  }

  private async expireEscrow(
    escrow: Escrow,
    reason: string,
  ): Promise<Escrow> {
    this.logger.log(`Auto-expiring escrow: ${escrow.id}`);

    const expiredEscrow = await this.escrowService.expireBySystem(
      escrow.id,
      reason,
    );

    await this.notifyParties(expiredEscrow, NotificationEventType.ESCROW_EXPIRED, {
      reason,
      expiredAt: expiredEscrow.expiresAt,
    });

    this.logger.log(`Successfully expired escrow: ${escrow.id}`);
    return expiredEscrow;
  }

  private async sendExpirationWarning(
    escrow: Escrow,
    warningField: WarningField,
    warningLabel: string,
  ) {
    this.logger.log(`Sending ${warningLabel} expiration warning for ${escrow.id}`);

    (escrow as any)[warningField] = new Date();
    await this.escrowRepository.save(escrow);

    const lastEvent = await this.escrowEventRepository.findOne({
      where: {},
      order: { cursor: 'DESC' },
    });
    const lastCursor = lastEvent?.cursor ? BigInt(lastEvent.cursor) : BigInt(0);
    const nextCursor = (lastCursor + BigInt(1)).toString();

    await this.escrowEventRepository.save({
      escrowId: escrow.id,
      eventType: EscrowEventType.EXPIRATION_WARNING_SENT,
      data: {
        expiresAt: escrow.expiresAt,
        warnedAt: new Date(),
        warningLevel: warningLabel,
      },
      cursor: nextCursor,
    });

    await this.notifyParties(
      escrow,
      NotificationEventType.EXPIRATION_WARNING,
      {
        expiresAt: escrow.expiresAt,
        hoursUntilExpiry: this.getHoursUntilExpiry(escrow.expiresAt!),
        warningLevel: warningLabel,
      },
    );

    this.logger.log(
      `Successfully sent ${warningLabel} warning for escrow: ${escrow.id}`,
    );
  }

  private async notifyParties(
    escrow: Escrow,
    eventType: NotificationEventType,
    data: Record<string, unknown>,
  ) {
    const recipients = new Map<string, { id: string }>();

    if (escrow.creator?.id) {
      recipients.set(escrow.creator.id, escrow.creator as any);
    }

    for (const party of escrow.parties ?? []) {
      if (party.user?.id) {
        recipients.set(party.user.id, party.user);
      }
    }

    for (const user of recipients.values()) {
      try {
        await this.notificationService.handleEscrowEvent(user.id, eventType, {
          escrowId: escrow.id,
          escrowTitle: escrow.title,
          ...data,
        });
      } catch (error) {
        this.logger.error(
          `Failed to create notification for user ${user.id} on escrow ${escrow.id}:`,
          error,
        );
      }
    }
  }

  private getHoursUntilExpiry(expiresAt: Date): number {
    const now = new Date();
    const diffMs = expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(diffMs / this.hourMs));
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

    let processedEscrow = escrow;

    if (
      escrow.status === EscrowStatus.PENDING ||
      escrow.status === EscrowStatus.ACTIVE
    ) {
      processedEscrow = await this.expireEscrow(
        escrow,
        escrow.status === EscrowStatus.PENDING
          ? 'EXPIRED_PENDING'
          : 'EXPIRED_ACTIVE',
      );
    }

    if (processedEscrow.status === EscrowStatus.EXPIRED) {
      await this.escrowService.refundExpiredEscrow(processedEscrow.id);
    }
  }
}
