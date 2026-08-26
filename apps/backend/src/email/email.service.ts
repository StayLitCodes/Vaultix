import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { createTransport } from 'nodemailer';
import { LessThanOrEqual, Repository } from 'typeorm';
import { EmailOutbox, EmailOutboxStatus } from './entities/email-outbox.entity';

interface EmailTransporter {
  sendMail(options: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html: string;
  }): Promise<unknown>;
  verify(): Promise<unknown>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: EmailTransporter;
  private readonly fromAddress: string;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly configured: boolean;
  /** When false (EMAIL_ENABLED=false), emails are logged but not sent. */
  private readonly enabled: boolean;

  constructor(
    @InjectRepository(EmailOutbox)
    private readonly outboxRepository: Repository<EmailOutbox>,
    private readonly configService: ConfigService,
  ) {
    const host = this.configService.get<string>('email.host', '');
    const port = this.configService.get<number>('email.port', 587);
    const user = this.configService.get<string>('email.user', '');
    const pass = this.configService.get<string>('email.pass', '');

    this.fromAddress = this.configService.get<string>(
      'email.from',
      'no-reply@vaultix.local',
    );
    this.maxAttempts = this.configService.get<number>('email.maxAttempts', 5);
    this.retryBaseDelayMs = this.configService.get<number>(
      'email.retryBaseDelayMs',
      60000,
    );
    this.configured = Boolean(host);

    // Dry-run mode: EMAIL_ENABLED=false means log-only, no actual sends.
    const enabledFlag = this.configService.get<string>('EMAIL_ENABLED', 'true');
    this.enabled = enabledFlag.toLowerCase() !== 'false';

    if (!this.enabled) {
      this.logger.warn(
        'Email delivery is DISABLED (EMAIL_ENABLED=false). ' +
          'Emails will be logged but not sent.',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any) as unknown as EmailTransporter;
  }

  get isConfigured(): boolean {
    return this.configured;
  }

  /** Whether live delivery is active (EMAIL_ENABLED != false). */
  get isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enqueue an email for async delivery. Non-blocking: the outbox cron
   * picks it up, sends it, and retries with exponential backoff on failure.
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<EmailOutbox> {
    const email = this.outboxRepository.create({
      to,
      subject,
      html,
      text,
      status: EmailOutboxStatus.PENDING,
      attempts: 0,
      nextRetryAt: new Date(),
    });
    return this.outboxRepository.save(email);
  }

  /**
   * Send an email immediately, bypassing the outbox queue. Used by the
   * outbox processor and by callers that manage their own retries
   * (e.g. the notification system).
   *
   * When EMAIL_ENABLED=false (dry-run mode), the email is logged but not
   * delivered. Callers should treat this as a successful no-op.
   */
  async sendEmailNow(
    to: string,
    subject: string,
    html: string,
    text?: string,
  ): Promise<void> {
    if (!this.enabled) {
      this.logger.log(
        `[DRY-RUN] Would send email to="${to}" subject="${subject}"`,
      );
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to,
        subject,
        text,
        html,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `SMTP delivery failed: to="${to}" subject="${subject}" error="${message}"`,
        stack,
      );
      throw error;
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processOutbox(): Promise<void> {
    const pending = await this.outboxRepository.find({
      where: {
        status: EmailOutboxStatus.PENDING,
        nextRetryAt: LessThanOrEqual(new Date()),
      },
      order: { createdAt: 'ASC' },
      take: 25,
    });

    for (const email of pending) {
      try {
        await this.sendEmailNow(
          email.to,
          email.subject,
          email.html,
          email.text ?? undefined,
        );
        email.status = EmailOutboxStatus.SENT;
        email.sentAt = new Date();
      } catch (error) {
        email.attempts += 1;
        email.lastError =
          error instanceof Error ? error.message : String(error);

        if (email.attempts >= this.maxAttempts) {
          email.status = EmailOutboxStatus.FAILED;
          this.logger.error(
            `Email ${email.id} to ${email.to} permanently failed after ${email.attempts} attempts: ${email.lastError}`,
          );
        } else {
          // Exponential backoff: base * 2^(attempts - 1)
          const delay = this.retryBaseDelayMs * 2 ** (email.attempts - 1);
          email.nextRetryAt = new Date(Date.now() + delay);
          this.logger.warn(
            `Email ${email.id} to ${email.to} failed (attempt ${email.attempts}/${this.maxAttempts}), retrying in ${delay}ms`,
          );
        }
      }

      await this.outboxRepository.save(email);
    }
  }

  /**
   * Verify SMTP connectivity for health checks.
   */
  async checkHealth(): Promise<boolean> {
    if (!this.configured) {
      return false;
    }
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.warn(
        `SMTP health check failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
