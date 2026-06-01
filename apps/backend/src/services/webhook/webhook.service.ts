import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  OnModuleDestroy,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { Webhook } from '../../modules/webhook/webhook.entity';
import { WebhookDelivery } from '../../modules/webhook/webhook-delivery.entity';
import {
  WebhookEvent,
  WebhookPayload,
} from '../../types/webhook/webhook.types';
import * as crypto from 'crypto';
import axios from 'axios';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class WebhookService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookService.name);
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly MAX_WEBHOOKS_PER_USER = 10;
  private readonly MAX_EVENTS_PER_WEBHOOK = 8;

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepo: Repository<Webhook>,
    @InjectRepository(WebhookDelivery)
    private readonly deliveryRepo: Repository<WebhookDelivery>,
  ) {}

  onModuleDestroy() {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout);
    }
    this.timeouts.clear();
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
          payload,
          status: 'pending',
          attempts: 0,
        });
        const savedDelivery = await this.deliveryRepo.save(delivery);
        void this.deliverWebhook(savedDelivery.id);
      }
    }
  }

  async deliverWebhook(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepo.findOne({
      where: { id: deliveryId },
      relations: ['webhook'],
    });

    if (!delivery || delivery.status === 'delivered' || delivery.status === 'failed') {
      return;
    }

    const maxAttempts = 5;
    const webhook = delivery.webhook;
    const attempt = delivery.attempts + 1;
    const backoff = Math.pow(2, attempt) * 1000;
    const signature = this.signPayload(webhook.secret, delivery.payload);

    try {
      const response = await axios.post(webhook.url, delivery.payload, {
        headers: {
          'X-Vaultix-Signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      delivery.status = 'delivered';
      delivery.attempts = attempt;
      delivery.lastStatusCode = response.status;
      delivery.errorMessage = null;
      delivery.nextRetryAt = null;

      await this.deliveryRepo.save(delivery);
      this.logger.log(`Webhook delivered to ${webhook.url}`);
    } catch (err: unknown) {
      let errorMsg = 'Unknown error';
      let statusCode = null;

      if (axios.isAxiosError(err)) {
        errorMsg = err.message;
        statusCode = err.response?.status || null;
      } else if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMsg = (err as { message?: string }).message ?? errorMsg;
      }

      delivery.attempts = attempt;
      delivery.lastStatusCode = statusCode;
      delivery.errorMessage = errorMsg;

      this.logger.warn(
        `Webhook delivery failed (attempt ${attempt}) to ${webhook.url}: ${errorMsg}`,
      );

      if (attempt < maxAttempts) {
        delivery.status = 'retrying';
        delivery.nextRetryAt = new Date(Date.now() + backoff);
        await this.deliveryRepo.save(delivery);

        const timeoutId = `${delivery.id}-${attempt}`;
        const timeout = setTimeout(() => {
          this.timeouts.delete(timeoutId);
          void this.deliverWebhook(delivery.id);
        }, backoff);
        this.timeouts.set(timeoutId, timeout);
      } else {
        delivery.status = 'failed';
        delivery.nextRetryAt = null;
        await this.deliveryRepo.save(delivery);
        this.logger.error(
          `Webhook delivery permanently failed to ${webhook.url}`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async handlePendingDeliveries() {
    const stuckDeliveries = await this.deliveryRepo.find({
      where: [
        { status: 'pending', createdAt: LessThanOrEqual(new Date(Date.now() - 60000)) },
        { status: 'retrying', nextRetryAt: LessThanOrEqual(new Date()) },
      ],
    });

    for (const delivery of stuckDeliveries) {
      void this.deliverWebhook(delivery.id);
    }
  }

  async getFailedDeliveries(): Promise<WebhookDelivery[]> {
    return this.deliveryRepo.find({
      where: { status: 'failed' },
      order: { createdAt: 'DESC' },
      relations: ['webhook'],
    });
  }

  async retryDelivery(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryRepo.findOne({ where: { id: deliveryId } });
    if (!delivery) throw new NotFoundException('Delivery not found');
    if (delivery.status !== 'failed') throw new UnprocessableEntityException('Can only retry failed deliveries');
    
    delivery.status = 'pending';
    delivery.attempts = 0;
    await this.deliveryRepo.save(delivery);
    void this.deliverWebhook(delivery.id);
  }

  async getHealthStatus() {
    const total = await this.deliveryRepo.count();
    const delivered = await this.deliveryRepo.count({ where: { status: 'delivered' } });
    const failed = await this.deliveryRepo.count({ where: { status: 'failed' } });
    const successRate = total > 0 ? (delivered / total) * 100 : 100;
    
    return { total, delivered, failed, successRate };
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
