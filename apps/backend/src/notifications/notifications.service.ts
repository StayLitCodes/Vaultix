import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  NotificationChannel,
  NotificationEventType,
  NotificationStatus,
} from './enums/notification-event.enum';
import { NotificationSender } from './interface/notification-sender.interface';
import { Notification } from './entities/notification.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { WebhookSender } from './senders/webhook.sender';
import { Repository, IsNull } from 'typeorm';
import { EmailSender } from './senders/email.sender';
import { PreferenceService } from './preference.service';

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
          escrowId: (payload.escrowId as string) || undefined,
          status: NotificationStatus.PENDING,
        }),
      );
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPendingNotifications() {
    this.logger.debug('Starting pending notifications processing');
    const pending = await this.repo.find({
      where: { status: NotificationStatus.PENDING },
      take: 50,
    });

    for (const notification of pending) {
      try {
        const prefs = await this.preferenceService.getUserPreferences(
          notification.userId,
        );

        for (const pref of prefs) {
          if (!pref.enabled) continue;
          if (!pref.eventTypes.includes(notification.eventType)) continue;

          const sender = this.senders.get(pref.channel);
          if (!sender) continue;

          await sender.send(notification);
        }

        notification.status = NotificationStatus.SENT;
      } catch (error) {
        notification.retryCount += 1;
        notification.status =
          notification.retryCount > 3
            ? NotificationStatus.FAILED
            : NotificationStatus.PENDING;
        this.logger.error(
          `Failed to process notification ${notification.id}; retryCount=${notification.retryCount}`,
          error instanceof Error ? error.stack : String(error),
        );
      }

      await this.repo.save(notification);
    }
  }

  async getUserNotifications(userId: string) {
    return this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(userId: string, notificationId?: string) {
    if (notificationId) {
      const notification = await this.repo.findOne({
        where: { id: notificationId, userId },
      });
      if (!notification) {
        throw new Error('Notification not found');
      }
      notification.readAt = new Date();
      await this.repo.save(notification);
      return notification;
    } else {
      // Mark all as read
      await this.repo.update(
        { userId, readAt: IsNull() },
        { readAt: new Date() },
      );
      return { success: true };
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.repo.count({
      where: { userId, readAt: IsNull() },
    });
  }
}
