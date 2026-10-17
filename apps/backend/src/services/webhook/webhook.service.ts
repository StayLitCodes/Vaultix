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
import { getCorrelationId } from '../../utils/logger.util';

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
    const correlationId = getCorrelationId();
    let statusCode: number | null = null;
    let errorMsg: string | null = null;

    try {
      const headers: Record<string, string> = {
        'X-Vaultix-Signature': signature,
        'Content-Type': 'application/json',
      };
      if (correlationId) {
        headers['X-Request-Id'] = correlationId;
      }
      const response = await axios.post(webhook.url, payload, {
        headers,
        timeout: this.requestTimeoutMs,
      });
      statusCode = response.status;
      delivery.status = WebhookDeliveryStatus.DELIVERED;
      delivery.nextRetryAt = null;
      this.logger.log(
        JSON.stringify({
          type: 'webhook_delivered',
          correlationId,
          url: webhook.url,
          statusCode,
        }),
      );
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
          JSON.stringify({
            type: 'webhook_retry',
            correlationId,
            url: webhook.url,
            attempt: delivery.attempt - 1,
            maxAttempts: delivery.maxAttempts,
            error: errorMsg,
            backoffMs,
          }),
        );
      } else {
        delivery.status = WebhookDeliveryStatus.DEAD_LETTERED;
        delivery.nextRetryAt = null;
        this.logger.error(
          JSON.stringify({
            type: 'webhook_dead_letter',
            correlationId,
            url: webhook.url,
            attempts: delivery.attempt,
            error: errorMsg,
          }),
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

  async getFailedDeliveries(filters?: {
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

    const successRate = total > 0 ? (delivered / total) * 100 : 0;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;

    return {
      total,
      delivered,
      failed,
      retrying,
      pending,
      deadLettered,
      successRate,
      failureRate,
    };
  }

  private signPayload(secret: string, payload: WebhookPayload): string {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }
}
