import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { EmailTemplateService } from './email-template.service';
import { Notification } from '../entities/notification.entity';

export interface SendResult {
  success: boolean;
  messageId?: string;
  dryRun?: boolean;
  error?: string;
}

interface QueueItem {
  notification: Notification;
  recipientEmail: string;
  resolve: (result: SendResult) => void;
  reject: (err: unknown) => void;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly enabled: boolean;
  private readonly dryRun: boolean;

  // Simple in-process queue (FIFO). For production scale, replace with
  // a proper queue (BullMQ, SQS, etc.).
  private readonly queue: QueueItem[] = [];
  private processing = false;

  // Retry policy
  private readonly maxRetries = 3;
  private readonly baseDelayMs = 1_000; // 1 s → 2 s → 4 s

  constructor(
    private readonly configService: ConfigService,
    private readonly templateService: EmailTemplateService,
  ) {
    const host = configService.get<string>('SMTP_HOST');
    const port = Number(configService.get<string>('SMTP_PORT', '587'));
    const user = configService.get<string>('SMTP_USER');
    const pass = configService.get<string>('SMTP_PASS');

    this.fromAddress = configService.get<string>(
      'EMAIL_FROM',
      'no-reply@vaultix.io',
    );

    // EMAIL_ENABLED defaults to false (safe for development)
    const enabledStr = configService.get<string>('EMAIL_ENABLED', 'false');
    this.enabled = enabledStr.toLowerCase() === 'true';

    // NODE_ENV=test or EMAIL_ENABLED=false both activate dry-run mode
    const nodeEnv = configService.get<string>('NODE_ENV', 'development');
    this.dryRun = !this.enabled || nodeEnv === 'test';

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    if (this.dryRun) {
      this.logger.warn(
        'EmailService running in DRY-RUN mode — no emails will be sent. ' +
          'Set EMAIL_ENABLED=true to enable delivery.',
      );
    } else {
      this.logger.log('EmailService initialised with live SMTP delivery.');
    }
  }

  // ---------------------------------------------------------------------------
  // Public: enqueue a notification for async delivery
  // ---------------------------------------------------------------------------

  /**
   * Enqueue a notification for async email delivery.
   * Resolves immediately; the send happens in the background queue.
   */
  enqueue(notification: Notification): Promise<SendResult> {
    const recipientEmail = this.resolveRecipient(notification.payload);

    if (!recipientEmail) {
      const msg = `No recipient email found in payload for notification ${notification.id}`;
      this.logger.warn(msg);
      return Promise.resolve({ success: false, error: msg });
    }

    return new Promise<SendResult>((resolve, reject) => {
      this.queue.push({ notification, recipientEmail, resolve, reject });
      void this.processQueue();
    });
  }

  // ---------------------------------------------------------------------------
  // Queue processing
  // ---------------------------------------------------------------------------

  private async processQueue(): Promise<void> {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      const result = await this.sendWithRetry(
        item.notification,
        item.recipientEmail,
      );

      if (result.success) {
        item.resolve(result);
      } else {
        // We resolved with failure info rather than rejecting — callers can
        // inspect `result.success`. Rejection is reserved for unexpected
        // programming errors.
        item.resolve(result);
      }
    }

    this.processing = false;
  }

  // ---------------------------------------------------------------------------
  // Send with exponential back-off retry
  // ---------------------------------------------------------------------------

  private async sendWithRetry(
    notification: Notification,
    recipientEmail: string,
  ): Promise<SendResult> {
    const template = this.templateService.build(notification);

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.attemptSend(
          notification,
          recipientEmail,
          template.subject,
          template.html,
          template.text,
        );

        this.logger.log(
          JSON.stringify({
            event: 'email_sent',
            notificationId: notification.id,
            recipient: recipientEmail,
            template: notification.eventType,
            messageId: result.messageId,
            attempt,
            dryRun: this.dryRun,
          }),
        );

        return result;
      } catch (err) {
        const isLastAttempt = attempt === this.maxRetries;
        const delayMs = this.baseDelayMs * Math.pow(2, attempt - 1);

        this.logger.error(
          JSON.stringify({
            event: 'email_send_failed',
            notificationId: notification.id,
            recipient: recipientEmail,
            template: notification.eventType,
            attempt,
            maxRetries: this.maxRetries,
            willRetry: !isLastAttempt,
            error: err instanceof Error ? err.message : String(err),
          }),
          err instanceof Error ? err.stack : undefined,
        );

        if (isLastAttempt) {
          return {
            success: false,
            error: err instanceof Error ? err.message : String(err),
          };
        }

        await this.sleep(delayMs);
      }
    }

    // Unreachable, but keeps TypeScript happy
    return { success: false, error: 'Exhausted retries' };
  }

  // ---------------------------------------------------------------------------
  // Single send attempt
  // ---------------------------------------------------------------------------

  private async attemptSend(
    notification: Notification,
    to: string,
    subject: string,
    html: string,
    text: string,
  ): Promise<SendResult> {
    if (this.dryRun) {
      this.logger.debug(
        `[DRY-RUN] Would send "${subject}" to ${to} ` +
          `(notificationId: ${notification.id})`,
      );
      return { success: true, dryRun: true };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const info = await (this.transporter as any).sendMail({
      from: this.fromAddress,
      to,
      subject,
      html,
      text,
    });

    return {
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      messageId: info?.messageId,
    };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private resolveRecipient(payload: Record<string, unknown>): string | null {
    const candidates = [
      'email',
      'userEmail',
      'recipientEmail',
      'to',
      'buyerEmail',
      'sellerEmail',
    ];
    for (const key of candidates) {
      const v = payload[key];
      if (typeof v === 'string' && v.trim().length > 0) return v.trim();
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ---------------------------------------------------------------------------
  // Accessor for tests
  // ---------------------------------------------------------------------------

  get isDryRun(): boolean {
    return this.dryRun;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }
}
