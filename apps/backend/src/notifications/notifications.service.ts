import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
} from './enums/notification-event.enum';
import { NotificationSender } from './interface/notification-sender.interface';
import { Notification } from './entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { WebhookSender } from './senders/webhook.sender';
import { Repository } from 'typeorm';
import { EmailSender } from './senders/email.sender';
import { PreferenceService } from './preference.service';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private senders: Map<NotificationChannel, NotificationSender>;

  constructor(
    @InjectRepository(Notification)
    private repo: Repository<Notification>,
    private preferenceService: PreferenceService,
    emailSender: EmailSender,
    webhookSender: WebhookSender,
  ) {
    this.senders = new Map([
      [NotificationChannel.EMAIL, emailSender],
      [NotificationChannel.WEBHOOK, webhookSender],
    ]);
  }

  async handleEscrowEvent(
    userId: string,
    eventType: NotificationEventType,
    payload: Record<string, unknown>,
  ) {
    const prefs = await this.preferenceService.getUserPreferences(userId);

    for (const pref of prefs) {
      if (!pref.enabled) continue;
      if (!pref.eventTypes.includes(eventType)) continue;

      await this.repo.save(
        this.repo.create({
          userId,
          eventType,
          payload,
          status: NotificationStatus.PENDING,
        }),
      );
    }
  }

  @Cron('*/30 * * * * *')
  async processPendingNotifications() {
    const pending = await this.repo.find({
      where: { status: NotificationStatus.PENDING },
      take: 50,
    });

    if (pending.length === 0) return;

    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const notification of pending) {
      processed++;
      try {
        const prefs = await this.preferenceService.getUserPreferences(
          notification.userId,
        );

        let sentViaAny = false;
        for (const pref of prefs) {
          if (!pref.enabled) continue;
          if (!pref.eventTypes.includes(notification.eventType)) continue;

          const sender = this.senders.get(pref.channel);
          if (!sender) continue;

          await sender.send(notification);
          sentViaAny = true;
        }

        if (sentViaAny) {
          notification.status = NotificationStatus.SENT;
          sent++;
        } else {
          // If no preferences enabled for this event, we consider it sent/done
          notification.status = NotificationStatus.SENT;
        }
      } catch (error) {
        notification.retryCount += 1;
        if (notification.retryCount >= 3) {
          notification.status = NotificationStatus.FAILED;
          failed++;
          this.logger.error(
            `Notification ${notification.id} failed after 3 retries. Dead-letter log: ${JSON.stringify(notification)}`,
            error.stack,
          );
        } else {
          notification.status = NotificationStatus.PENDING;
        }
      }

      await this.repo.save(notification);
    }

    this.logger.log(
      `Cron run complete: processed=${processed}, sent=${sent}, failed=${failed}`,
    );
  }

  async getQueueDepth() {
    return this.repo.count({
      where: { status: NotificationStatus.PENDING },
    });
  }

  async getUserNotifications(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}
