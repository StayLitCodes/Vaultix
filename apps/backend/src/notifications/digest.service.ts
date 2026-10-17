import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationPreference } from './entities/notification-preference.entity';
import { NotificationChannel } from './enums/notification-event.enum';
import { User } from '../modules/user/entities/user.entity';
import { EmailService } from '../email/email.service';
import {
  baseLayout,
  detailRow,
  greeting,
  paragraph,
} from '../email/templates/base-layout';

const MAX_ITEMS_PER_DIGEST = 100;

/**
 * Daily email digest: batches unread notifications for users who enabled
 * `digestEnabled` on their email preference. Per-event emails are skipped
 * for those users (see NotificationService), so each item is sent once.
 */
@Injectable()
export class DigestService {
  private readonly logger = new Logger(DigestService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifications: Repository<Notification>,
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  @Cron(process.env.NOTIFICATION_DIGEST_CRON || '0 8 * * *')
  async sendDailyDigests(): Promise<number> {
    const prefs = await this.preferences.find({
      where: {
        channel: NotificationChannel.EMAIL,
        enabled: true,
        digestEnabled: true,
      },
    });

    let sent = 0;
    for (const pref of prefs) {
      try {
        if (await this.sendDigestForUser(pref)) sent += 1;
      } catch (error) {
        this.logger.error(
          `Failed to send digest for user ${pref.userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }
    return sent;
  }

  async sendDigestForUser(pref: NotificationPreference): Promise<boolean> {
    const user = await this.users.findOne({ where: { id: pref.userId } });
    if (!user?.email) return false;

    if (pref.eventTypes.length === 0) return false;
    const items = await this.notifications.find({
      where: {
        userId: pref.userId,
        readAt: IsNull(),
        digestedAt: IsNull(),
        eventType: In(pref.eventTypes),
      },
      order: { createdAt: 'ASC' },
      take: MAX_ITEMS_PER_DIGEST,
    });
    if (items.length === 0) return false;

    const { subject, html, text } = this.render(items);
    await this.emailService.sendEmailNow(user.email, subject, html, text);

    await this.notifications.update(
      { id: In(items.map((n) => n.id)) },
      { digestedAt: new Date() },
    );
    return true;
  }

  private label(n: Notification): string {
    const title =
      typeof n.payload?.escrowTitle === 'string' ? n.payload.escrowTitle : '';
    const event = n.eventType.toLowerCase().replace(/_/g, ' ');
    return title ? `${event} - ${title}` : event;
  }

  private render(items: Notification[]) {
    const count = items.length;
    const subject = `Your Vaultix digest: ${count} unread notification${count === 1 ? '' : 's'}`;
    const html = baseLayout({
      preheader: subject,
      heading: 'Daily digest',
      bodyHtml:
        greeting() +
        paragraph(
          `You have ${count} unread notification${count === 1 ? '' : 's'}.`,
        ) +
        items
          .map((n) => detailRow(n.createdAt.toISOString(), this.label(n)))
          .join(''),
    });
    const text = [
      `You have ${count} unread notification${count === 1 ? '' : 's'}:`,
      '',
      ...items.map((n) => `- ${n.createdAt.toISOString()} ${this.label(n)}`),
    ].join('\n');
    return { subject, html, text };
  }
}
