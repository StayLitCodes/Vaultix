import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThanOrEqual, In, IsNull } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { Webhook } from '../../modules/webhook/webhook.entity';
import { WebhookDelivery } from '../../modules/webhook/entities/webhook-delivery.entity';
import { WebhookDeadLetter } from '../../modules/webhook/entities/webhook-dead-letter.entity';
import {
  WebhookEvent,
  WebhookPayload,
  WebhookDeliveryStatus,
} from '../../types/webhook/webhook.types';
import * as crypto from 'crypto';
import axios from 'axios';

// Exponential backoff schedule: 1m, 5m, 30m, 2h, 12h, 24h
const DEFAULT_RETRY_SCHEDULE_MS = [
  60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 86_400_000,
];

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly MAX_WEBHOOKS_PER_USER = 10;
  private readonly MAX_EVENTS_PER_WEBHOOK = 8;
  private readonly maxAttempts: number;
  private readonly retryScheduleMs: number[];
  private readonly requestTimeoutMs: number;
  private readonly alertFailureRateThreshold: number;
  private readonly alertMinDeliveries: number;
  private readonly alertWindowMinutes: number;
  private lastAlert: {
    triggeredAt: string;
    failureRate: number;
    windowMinutes: number;
  } | null = null;

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepo: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
    @InjectRepository(WebhookDeadLetter)
    private readonly deadLetterRepo: Repository<WebhookDeadLetter>,
    private readonly configService: ConfigService,
  ) {
    this.maxAttempts = this.configService.get<number>('webhook.maxAttempts', 6);
    this.retryScheduleMs = this.configService.get<number[]>(
      'webhook.retryScheduleMs',
      DEFAULT_RETRY_SCHEDULE_MS,
    );
    this.requestTimeoutMs = this.configService.get<number>(
      'webhook.requestTimeoutMs',
      30_000,
    );
    this.alertFailureRateThreshold = this.configService.get<number>(
      'webhook.alertFailureRateThreshold',
      25,
    );
    this.alertMinDeliveries = this.configService.get<number>(
      'webhook.alertMinDeliveries',
      10,
    );
    this.alertWindowMinutes = this.configService.get<number>(
      'webhook.alertWindowMinutes',
      60,
    );
  }

  /** Backoff delay for a given (1-based) attempt, clamped to the last step. */
  private getBackoffDelayMs(attempt: number): number {
    const index = Math.min(attempt - 1, this.retryScheduleMs.length - 1);
    return this.retryScheduleMs[Math.max(index, 0)];
  }

  async createWebhook(
    userId: string,
    url: string,
    secret: string,
    events: WebhookEvent[],
  ): Promise<Webhook> {
    if (events.length > this.MAX_EVENTS_PER_WEBHOOK) {
      throw new UnprocessableEntityException(
        `Maximum ${this.MAX_EVENTS_PER_WEBHOOK} events allowed per webhook`,
      );
    }

    const existingWebhooks = await this.getUserWebhooks(userId);
    if (existingWebhooks.length >= this.MAX_WEBHOOKS_PER_USER) {
      throw new UnprocessableEntityException(
        `Maximum ${this.MAX_WEBHOOKS_PER_USER} webhooks allowed per user`,
      );
    }

    const webhook = this.webhookRepo.create({
      url,
      secret,
      events,
      user: { id: userId },
      isActive: true,
    });
    return this.webhookRepo.save(webhook);
  }

  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    return this.webhookRepo.find({ where: { user: { id: userId } } });
  }

  async deleteWebhook(userId: string, webhookId: string): Promise<void> {
    const webhook = await this.webhookRepo.findOne({
      where: { id: webhookId },
      relations: ['user'],
    });
    if (!webhook) throw new NotFoundException('Webhook not found');
    if (webhook.user.id !== userId)
      throw new ForbiddenException('Not your webhook');
    await this.webhookRepo.delete(webhookId);
  }

  async dispatchEvent(event: WebhookEvent, data: unknown): Promise<void> {
    const webhooks = await this.webhookRepo.find({ where: { isActive: true } });
    const payload: WebhookPayload = {
      event,
      data,
      timestamp: new Date().toISOString(),
    };
    for (const webhook of webhooks) {
      if (webhook.events.includes(event)) {
        const delivery = this.deliveryRepo.create({
          webhook,
          webhookId: webhook.id,
          event,
          payload: payload as unknown as Record<string, unknown>,
          status: WebhookDeliveryStatus.PENDING,
          attempt: 1,
          maxAttempts: this.maxAttempts,
          nextRetryAt: new Date(),
          lastStatusCode: null,
          lastError: null,
          lastAttemptAt: null,
        });
        const saved = await this.deliveryRepo.save(delivery);
        void this.attemptDelivery(saved);
      }
    }
  }

  async attemptDelivery(delivery: WebhookDelivery): Promise<void> {
    const webhook =
      delivery.webhook ??
      (await this.webhookRepo.findOne({ where: { id: delivery.webhookId } }));
    if (!webhook) {
      delivery.status = WebhookDeliveryStatus.FAILED;
      delivery.lastError = 'Webhook not found';
      delivery.lastAttemptAt = new Date();
      await this.deliveryRepo.save(delivery);
      return;
    }

    const payload = delivery.payload as unknown as WebhookPayload;
    const signature = this.signPayload(webhook.secret, payload);
    let statusCode: number | null = null;
    let errorMsg: string | null = null;

    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'X-Vaultix-Signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: this.requestTimeoutMs,
      });
      statusCode = response.status;
      delivery.status = WebhookDeliveryStatus.DELIVERED;
      delivery.nextRetryAt = null;
      this.logger.log(`Webhook delivered to ${webhook.url}`);
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'response' in err) {
        const axiosErr = err as {
          response?: { status?: number };
          message?: string;
        };
        statusCode = axiosErr.response?.status ?? null;
        errorMsg = axiosErr.message ?? 'Unknown error';
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMsg = (err as { message?: string }).message ?? 'Unknown error';
      } else {
        errorMsg = 'Unknown error';
      }

      if (delivery.attempt < delivery.maxAttempts) {
        delivery.status = WebhookDeliveryStatus.RETRYING;
        const backoffMs = this.getBackoffDelayMs(delivery.attempt);
        delivery.nextRetryAt = new Date(Date.now() + backoffMs);
        delivery.attempt += 1;
        this.logger.warn(
          `Webhook delivery failed (attempt ${delivery.attempt - 1}/${delivery.maxAttempts}) to ${webhook.url}: ${errorMsg}, retrying in ${backoffMs}ms`,
        );
      } else {
        delivery.status = WebhookDeliveryStatus.DEAD_LETTERED;
        delivery.nextRetryAt = null;
        this.logger.error(
          `Webhook delivery permanently failed after ${delivery.attempt} attempts to ${webhook.url}, moving to dead letter queue`,
        );
        await this.moveToDeadLetter(delivery, statusCode, errorMsg);
      }
    }

    delivery.lastStatusCode = statusCode;
    delivery.lastError = errorMsg;
    delivery.lastAttemptAt = new Date();
    await this.deliveryRepo.save(delivery);
  }

  private async moveToDeadLetter(
    delivery: WebhookDelivery,
    statusCode: number | null,
    errorMsg: string | null,
  ): Promise<WebhookDeadLetter> {
    const deadLetter = this.deadLetterRepo.create({
      webhookId: delivery.webhookId,
      originalDeliveryId: delivery.id,
      event: delivery.event,
      payload: delivery.payload,
      attempts: delivery.attempt,
      lastStatusCode: statusCode,
      lastError: errorMsg,
      failedAt: new Date(),
      replayedAt: null,
    });
    return this.deadLetterRepo.save(deadLetter);
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async processRetries(): Promise<void> {
    const due = await this.deliveryRepo.find({
      where: {
        status: WebhookDeliveryStatus.RETRYING,
        nextRetryAt: LessThan(new Date()),
      },
      relations: ['webhook'],
      take: 50,
    });

    for (const delivery of due) {
      void this.attemptDelivery(delivery);
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async processPending(): Promise<void> {
    const pending = await this.deliveryRepo.find({
      where: {
        status: WebhookDeliveryStatus.PENDING,
        nextRetryAt: LessThan(new Date()),
      },
      relations: ['webhook'],
      take: 50,
    });

    for (const delivery of pending) {
      void this.attemptDelivery(delivery);
    }
  }

  async getFailedDelveys(filters?: {
    page?: number;
    limit?: number;
    webhookId?: string;
  }): Promise<{
    deliveries: WebhookDelivery[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const where: Record<string, unknown> = {
      status: WebhookDeliveryStatus.FAILED,
    };
    if (filters?.webhookId) where.webhookId = filters.webhookId;

    const [deliveries, total] = await this.deliveryRepo.findAndCount({
      where,
      relations: ['webhook'],
      skip: (page - 1) * limit,
      take: limit,
      order: { updatedAt: 'DESC' },
    });

    return {
      deliveries,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async manualRetry(deliveryId: string): Promise<WebhookDelivery> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ['webhook'],
    });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== WebhookDeliveryStatus.FAILED) {
      throw new ForbiddenException('Only failed deliveries can be retried');
    }

    delivery.status = WebhookDeliveryStatus.PENDING;
    delivery.attempt = 1;
    delivery.nextRetryAt = new Date();
    delivery.lastStatusCode = null;
    delivery.lastError = null;
    delivery.lastAttemptAt = null;
    await this.deliveryRepo.save(delivery);

    void this.attemptDelivery(delivery);
    return delivery;
  }

  async getHealthStats(): Promise<{
    total: number;
    delivered: number;
    failed: number;
    retrying: number;
    pending: number;
    deadLettered: number;
    successRate: number;
    failureRate: number;
  }> {
    const [total, delivered, failed, retrying, pending, deadLettered] =
      await Promise.all([
        this.deliveryRepo.count(),
        this.deliveryRepo.count({
          where: { status: WebhookDeliveryStatus.DELIVERED },
        }),
        this.deliveryRepo.count({
          where: { status: WebhookDeliveryStatus.FAILED },
        }),
        this.deliveryRepo.count({
          where: { status: WebhookDeliveryStatus.RETRYING },
        }),
        this.deliveryRepo.count({
          where: { status: WebhookDeliveryStatus.PENDING },
        }),
        this.deliveryRepo.count({
          where: { status: WebhookDeliveryStatus.DEAD_LETTERED },
        }),
      ]);

    const completed = delivered + failed + deadLettered;
    return {
      total,
      delivered,
      failed,
      retrying,
      pending,
      deadLettered,
      successRate:
        completed > 0 ? Math.round((delivered / completed) * 10000) / 100 : 0,
      failureRate:
        completed > 0
          ? Math.round(((failed + deadLettered) / completed) * 10000) / 100
          : 0,
    };
  }

  async getDeadLetters(filters?: {
    page?: number;
    limit?: number;
    webhookId?: string;
  }): Promise<{
    deadLetters: WebhookDeadLetter[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    const page = filters?.page ?? 1;
    const limit = filters?.limit ?? 20;

    const where: Record<string, unknown> = {};
    if (filters?.webhookId) where.webhookId = filters.webhookId;

    const [deadLetters, total] = await this.deadLetterRepo.findAndCount({
      where,
      relations: ['webhook'],
      skip: (page - 1) * limit,
      take: limit,
      order: { failedAt: 'DESC' },
    });

    return {
      deadLetters,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async replayDeadLetter(deadLetterId: string): Promise<WebhookDelivery> {
    const deadLetter = await this.deadLetterRepo.findOne({
      where: { id: deadLetterId },
      relations: ['webhook'],
    });
    if (!deadLetter) throw new NotFoundException('Dead letter not found');

    const webhook =
      deadLetter.webhook ??
      (await this.webhookRepo.findOne({
        where: { id: deadLetter.webhookId },
      }));
    if (!webhook) throw new NotFoundException('Webhook no longer exists');

    const delivery = this.deliveryRepo.create({
      webhook,
      webhookId: deadLetter.webhookId,
      event: deadLetter.event,
      payload: deadLetter.payload,
      status: WebhookDeliveryStatus.PENDING,
      attempt: 1,
      maxAttempts: this.maxAttempts,
      nextRetryAt: new Date(),
      lastStatusCode: null,
      lastError: null,
      lastAttemptAt: null,
    });
    const saved = await this.deliveryRepo.save(delivery);

    deadLetter.replayedAt = new Date();
    await this.deadLetterRepo.save(deadLetter);

    void this.attemptDelivery(saved);
    return saved;
  }

  async getMetrics(): Promise<{
    deliveries: {
      total: number;
      delivered: number;
      pending: number;
      retrying: number;
      failed: number;
      deadLettered: number;
    };
    successRate: number;
    failureRate: number;
    totalRetries: number;
    deadLetterCount: number;
    unreplayedDeadLetterCount: number;
    lastAlert: {
      triggeredAt: string;
      failureRate: number;
      windowMinutes: number;
    } | null;
  }> {
    const stats = await this.getHealthStats();
    const retrySum = await this.deliveryRepo
      .createQueryBuilder('delivery')
      .select('COALESCE(SUM(delivery.attempt - 1), 0)', 'totalRetries')
      .getRawOne<{ totalRetries: string }>();
    const [deadLetterCount, unreplayedDeadLetterCount] = await Promise.all([
      this.deadLetterRepo.count(),
      this.deadLetterRepo.count({ where: { replayedAt: IsNull() } }),
    ]);

    return {
      deliveries: {
        total: stats.total,
        delivered: stats.delivered,
        pending: stats.pending,
        retrying: stats.retrying,
        failed: stats.failed,
        deadLettered: stats.deadLettered,
      },
      successRate: stats.successRate,
      failureRate: stats.failureRate,
      totalRetries: Number(retrySum?.totalRetries ?? 0),
      deadLetterCount,
      unreplayedDeadLetterCount,
      lastAlert: this.lastAlert,
    };
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkFailureRateAlert(): Promise<void> {
    const since = new Date(Date.now() - this.alertWindowMinutes * 60_000);

    const [recentDelivered, recentFailed] = await Promise.all([
      this.deliveryRepo.count({
        where: {
          status: WebhookDeliveryStatus.DELIVERED,
          lastAttemptAt: MoreThanOrEqual(since),
        },
      }),
      this.deliveryRepo.count({
        where: {
          status: In([
            WebhookDeliveryStatus.FAILED,
            WebhookDeliveryStatus.DEAD_LETTERED,
          ]),
          lastAttemptAt: MoreThanOrEqual(since),
        },
      }),
    ]);

    const completed = recentDelivered + recentFailed;
    if (completed < this.alertMinDeliveries) return;

    const failureRate = Math.round((recentFailed / completed) * 10000) / 100;
    if (failureRate >= this.alertFailureRateThreshold) {
      this.lastAlert = {
        triggeredAt: new Date().toISOString(),
        failureRate,
        windowMinutes: this.alertWindowMinutes,
      };
      this.logger.error(
        `[ALERT] Webhook failure rate ${failureRate}% over the last ${this.alertWindowMinutes}m exceeds threshold ${this.alertFailureRateThreshold}% (${recentFailed}/${completed} deliveries failed)`,
      );
    }
  }

  signPayload(secret: string, payload: WebhookPayload): string {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  verifySignature(
    secret: string,
    payload: WebhookPayload,
    signature: string,
  ): boolean {
    const expected = this.signPayload(secret, payload);
    const expectedBuf = Buffer.from(expected);
    const signatureBuf = Buffer.from(signature);
    if (signatureBuf.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(signatureBuf, expectedBuf);
  }
}
