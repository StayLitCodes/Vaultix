import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Between, IsNull, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { EscrowService } from './escrow.service';
import { NotificationService } from '../../../notifications/notifications.service';
import { NotificationEventType } from '../../../notifications/enums/notification-event.enum';
import { EventsGateway } from '../../../gateways/events.gateway';

@Injectable()
export class EscrowSchedulerService {
  private readonly logger = new Logger(EscrowSchedulerService.name);

  constructor(
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(EscrowEvent)
    private escrowEventRepository: Repository<EscrowEvent>,
    private escrowService: EscrowService,
    private readonly notificationService: NotificationService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleExpiredEscrows() {
    this.logger.log('Starting expired escrow processing...');

    try {
      await this.processExpiredPendingEscrows();

      this.logger.log('Completed expired escrow processing');
    } catch (error) {
      this.logger.error('Error processing expired escrows:', error);
    }
  }

  @Cron('0 */15 * * * *')
  async sendExpirationWarnings() {
    const warningHours = this.getWarningHours();
    this.logger.log(`Sending ${warningHours}-hour expiration warnings...`);

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

  private async processExpirationWarnings() {
    const now = new Date();
    const warningThreshold = new Date(
      now.getTime() + this.getWarningHours() * 60 * 60 * 1000,
    );

    const escrowsNeedingWarning = await this.escrowRepository.find({
      where: {
        status: In([EscrowStatus.PENDING, EscrowStatus.ACTIVE]),
        expiresAt: Between(now, warningThreshold),
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
        if (!escrow.expiresAt || escrow.expiresAt <= now) continue;
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
    this.logger.log(`Auto-expiring pending escrow: ${escrow.id}`);

    const expiredEscrow = await this.escrowService.expireBySystem(
      escrow.id,
      'EXPIRED_PENDING',
    );

    await this.notifyParties(
      expiredEscrow,
      NotificationEventType.ESCROW_EXPIRED,
      {
        reason: 'Escrow expired while pending',
        expiredAt: expiredEscrow.expiresAt,
      },
    );

    this.logger.log(`Successfully expired pending escrow: ${escrow.id}`);
  }

  private async sendExpirationWarning(escrow: Escrow) {
    this.logger.log(`Sending expiration warning for escrow: ${escrow.id}`);

    const warnedAt = new Date();
    escrow.expirationNotifiedAt = warnedAt;
    await this.escrowRepository.save(escrow);

    const event = await this.escrowEventRepository.save({
      escrowId: escrow.id,
      eventType: EscrowEventType.EXPIRATION_WARNING_SENT,
      data: {
        expiresAt: escrow.expiresAt,
        warnedAt,
        warningHours: this.getWarningHours(),
      },
    });
    this.eventsGateway?.emitEscrowEvent(event);

    await this.notifyParties(escrow, NotificationEventType.EXPIRATION_WARNING, {
      expiresAt: escrow.expiresAt,
      hoursUntilExpiry: this.getHoursUntilExpiry(escrow.expiresAt!),
    });

    this.logger.log(
      `Successfully sent expiration warning for escrow: ${escrow.id}`,
    );
  }

  private async notifyParties(
    escrow: Escrow,
    eventType: NotificationEventType,
    data: Record<string, unknown>,
  ): Promise<void> {
    const recipients = new Map<string, { email?: string }>();
    if (escrow.creatorId) {
      recipients.set(escrow.creatorId, { email: escrow.creator?.email });
    }
    for (const party of escrow.parties ?? []) {
      if (party.userId) {
        recipients.set(party.userId, { email: party.user?.email });
      }
    }

    await Promise.all(
      [...recipients.entries()].map(async ([userId, user]) => {
        try {
          await this.notificationService.handleEscrowEvent(
            userId,
            eventType,
            {
              escrowId: escrow.id,
              escrowTitle: escrow.title,
              ...data,
              email: user.email,
            },
            `${eventType}:${escrow.id}:${userId}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to send ${eventType} notification to ${userId}:`,
            error,
          );
        }
      }),
    );
  }

  private getHoursUntilExpiry(expiresAt: Date): number {
    const diffMs = expiresAt.getTime() - Date.now();
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60)));
  }

  private getWarningHours(): number {
    const configured = Number(
      process.env.ESCROW_EXPIRATION_WARNING_HOURS ?? 24,
    );
    return Number.isFinite(configured) && configured > 0 ? configured : 24;
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
      throw new Error(
        `Active escrow ${escrowId} must be processed by the refund scheduler`,
      );
    } else {
      this.logger.log(
        `Escrow ${escrowId} already in terminal state: ${escrow.status}`,
      );
    }
  }
}
