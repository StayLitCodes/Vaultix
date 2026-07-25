import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Webhook } from '../../modules/webhook/webhook.entity';
import { WebhookDelivery } from '../../modules/webhook/entities/webhook-delivery.entity';
import {
  WebhookEvent,
  WebhookPayload,
  WebhookDeliveryStatus,
} from '../../types/webhook/webhook.types';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly MAX_WEBHOOKS_PER_USER = 10;
  private readonly MAX_EVENTS_PER_WEBHOOK = 8;
  private readonly MAX_RETRY_ATTEMPTS = 5;
  private readonly BASE_RETRY_DELAY_MS = 1000;

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepo: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
  ) {}

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
          maxAttempts: this.MAX_RETRY_ATTEMPTS,
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
        timeout: 5000,
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
        const backoffMs =
          this.BASE_RETRY_DELAY_MS * Math.pow(2, delivery.attempt - 1);
        const nextRetry = new Date(Date.now() + backoffMs);
        delivery.nextRetryAt = nextRetry;
        delivery.attempt += 1;
        this.logger.warn(
          `Webhook delivery failed (attempt ${delivery.attempt - 1}) to ${webhook.url}: ${errorMsg}`,
        );
      } else {
        delivery.status = WebhookDeliveryStatus.FAILED;
        delivery.nextRetryAt = null;
        this.logger.error(
          `Webhook delivery permanently failed to ${webhook.url}`,
        );
      }
    }

    delivery.lastStatusCode = statusCode;
    delivery.lastError = errorMsg;
    delivery.lastAttemptAt = new Date();
    await this.deliveryRepo.save(delivery);
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
    successRate: number;
    failureRate: number;
  }> {
    const [total, delivered, failed, retrying, pending] = await Promise.all([
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
    ]);

    const completed = delivered + failed;
    return {
      total,
      delivered,
      failed,
      retrying,
      pending,
      successRate:
        completed > 0 ? Math.round((delivered / completed) * 10000) / 100 : 0,
      failureRate:
        completed > 0 ? Math.round((failed / completed) * 10000) / 100 : 0,
    };
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
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }
}
