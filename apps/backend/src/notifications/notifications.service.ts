import { Injectable } from '@nestjs/common';
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

@Injectable()
export class NotificationService {
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

  async processPendingNotifications() {
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
      } catch {
        notification.retryCount += 1;
        notification.status =
          notification.retryCount > 3
            ? NotificationStatus.FAILED
            : NotificationStatus.PENDING;
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
}
