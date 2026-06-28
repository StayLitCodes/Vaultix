import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  OnModuleDestroy,
  UnprocessableEntityException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from '../../modules/webhook/webhook.entity';
import { WebhookDelivery } from '../../modules/webhook/webhook-delivery.entity';
import {
  WebhookEvent,
  WebhookPayload,
} from '../../types/webhook/webhook.types';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class WebhookService implements OnModuleDestroy {
  private readonly logger = new Logger(WebhookService.name);
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private readonly MAX_WEBHOOKS_PER_USER = 10;
  private readonly MAX_EVENTS_PER_WEBHOOK = 8;
  private readonly MAX_FAILURES = 5;
  private readonly RETRY_DELAYS_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];

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
    this.validateWebhookUrl(url);

    if (!events?.length) {
      throw new BadRequestException('At least one event is required');
    }

    if (events.length > this.MAX_EVENTS_PER_WEBHOOK) {
      throw new UnprocessableEntityException(
        `Maximum ${this.MAX_EVENTS_PER_WEBHOOK} events allowed per webhook`,
      );
    }

    // Check maximum webhooks per user
    const existingWebhooks = await this.getUserWebhooks(userId);
    if (existingWebhooks.length >= this.MAX_WEBHOOKS_PER_USER) {
      throw new UnprocessableEntityException(
        `Maximum ${this.MAX_WEBHOOKS_PER_USER} webhooks allowed per user`,
      );
    }

    const webhook = this.webhookRepo.create({
      url,
      secret: secret || crypto.randomBytes(24).toString('hex'),
      events,
      user: { id: userId },
      isActive: true,
    });
    return this.webhookRepo.save(webhook);
  }

  async getUserWebhooks(userId: string): Promise<Webhook[]> {
    return this.webhookRepo.find({ where: { user: { id: userId } } });
  }

  async updateWebhook(
    userId: string,
    webhookId: string,
    updates: Partial<Pick<Webhook, 'url' | 'events' | 'isActive'>>,
  ): Promise<Webhook> {
    const webhook = await this.webhookRepo.findOne({
      where: { id: webhookId },
      relations: ['user'],
    });

    if (!webhook) throw new NotFoundException('Webhook not found');
    if (webhook.user.id !== userId) throw new ForbiddenException('Not your webhook');

    if (updates.url) this.validateWebhookUrl(updates.url);
    if (updates.events && updates.events.length > this.MAX_EVENTS_PER_WEBHOOK) {
      throw new UnprocessableEntityException(
        `Maximum ${this.MAX_EVENTS_PER_WEBHOOK} events allowed per webhook`,
      );
    }

    Object.assign(webhook, updates);
    return this.webhookRepo.save(webhook);
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
        void this.deliverWebhook(webhook, payload);
      }
    }
  }

  async getWebhookDeliveries(userId: string, webhookId: string): Promise<WebhookDelivery[]> {
    const webhook = await this.webhookRepo.findOne({
      where: { id: webhookId },
      relations: ['user'],
    });

    if (!webhook) throw new NotFoundException('Webhook not found');
    if (webhook.user.id !== userId) throw new ForbiddenException('Not your webhook');

    return this.deliveryRepo.find({
      where: { webhook: { id: webhookId } },
      order: { createdAt: 'DESC' },
    });
  }

  async retryWebhookDelivery(userId: string, webhookId: string): Promise<WebhookDelivery> {
    const webhook = await this.webhookRepo.findOne({
      where: { id: webhookId },
      relations: ['user'],
    });

    if (!webhook) throw new NotFoundException('Webhook not found');
    if (webhook.user.id !== userId) throw new ForbiddenException('Not your webhook');

    const payload: WebhookPayload = {
      event: 'webhook.retry',
      data: { webhookId },
      timestamp: new Date().toISOString(),
    };

    return this.deliverWebhook(webhook, payload, 1, true);
  }

  async testWebhook(userId: string, webhookId: string): Promise<WebhookDelivery> {
    const webhook = await this.webhookRepo.findOne({
      where: { id: webhookId },
      relations: ['user'],
    });

    if (!webhook) throw new NotFoundException('Webhook not found');
    if (webhook.user.id !== userId) throw new ForbiddenException('Not your webhook');

    const payload: WebhookPayload = {
      event: 'webhook.test',
      data: { status: 'ping' },
      timestamp: new Date().toISOString(),
    };

    return this.deliverWebhook(webhook, payload, 1, true);
  }

  async deliverWebhook(
    webhook: Webhook,
    payload: WebhookPayload,
    attempt = 1,
    shouldPersist = false,
  ): Promise<WebhookDelivery> {
    const signature = this.signPayload(webhook.secret, payload);
    const delivery = this.deliveryRepo.create({
      webhook,
      event: payload.event,
      payload,
      attemptCount: attempt,
      nextRetryAt:
        attempt < this.MAX_FAILURES
          ? new Date(Date.now() + this.RETRY_DELAYS_MS[attempt - 1])
          : null,
    });
    const savedDelivery = await this.deliveryRepo.save(delivery);

    try {
      const response = await axios.post(webhook.url, payload, {
        headers: {
          'X-Vaultix-Signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });

      savedDelivery.responseStatus = response.status;
      savedDelivery.nextRetryAt = null;
      await this.deliveryRepo.save(savedDelivery);

      webhook.lastTriggeredAt = new Date();
      webhook.failureCount = 0;
      await this.webhookRepo.save(webhook);
      this.logger.log(`Webhook delivered to ${webhook.url}`);
      return savedDelivery;
    } catch (err: unknown) {
      let errorMsg = 'Unknown error';
      if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMsg = (err as { message?: string }).message ?? errorMsg;
      }
      this.logger.warn(
        `Webhook delivery failed (attempt ${attempt}) to ${webhook.url}: ${errorMsg}`,
      );

      savedDelivery.responseStatus = 0;
      await this.deliveryRepo.save(savedDelivery);

      webhook.failureCount += 1;
      const shouldDisable = webhook.failureCount >= this.MAX_FAILURES;
      if (shouldDisable) {
        webhook.isActive = false;
      }
      await this.webhookRepo.save(webhook);

      if (attempt < this.MAX_FAILURES) {
        const timeoutId = `${webhook.id}-${attempt}`;
        const timeout = setTimeout(() => {
          this.timeouts.delete(timeoutId);
          void this.deliverWebhook(webhook, payload, attempt + 1, shouldPersist);
        }, this.RETRY_DELAYS_MS[attempt - 1]);
        this.timeouts.set(timeoutId, timeout);
      }

      return savedDelivery;
    }
  }

  private validateWebhookUrl(url: string): void {
    try {
      const parsed = new URL(url);
      const requireHttps = process.env.NODE_ENV === 'production';
      if (requireHttps && parsed.protocol !== 'https:') {
        throw new BadRequestException('Webhook URL must use HTTPS');
      }
    } catch {
      throw new BadRequestException('Invalid webhook URL');
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
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }
}
