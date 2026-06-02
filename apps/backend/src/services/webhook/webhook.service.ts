import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
  OnModuleDestroy,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Webhook } from '../../modules/webhook/webhook.entity';
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

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepo: Repository<Webhook>,
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
    // Check maximum events per webhook
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
        // Await the promise or handle it properly
        void this.deliverWebhook(webhook, payload);
      }
    }
  }

  async deliverWebhook(
    webhook: Webhook,
    payload: WebhookPayload,
    attempt = 1,
  ): Promise<void> {
    const maxAttempts = 5;
    const backoff = Math.pow(2, attempt) * 1000;
    const signature = this.signPayload(webhook.secret, payload);
    try {
      await axios.post(webhook.url, payload, {
        headers: {
          'X-Vaultix-Signature': signature,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      });
      this.logger.log(`Webhook delivered to ${webhook.url}`);
    } catch (err: unknown) {
      let errorMsg = 'Unknown error';
      if (typeof err === 'object' && err !== null && 'message' in err) {
        errorMsg = (err as { message?: string }).message ?? errorMsg;
      }
      this.logger.warn(
        `Webhook delivery failed (attempt ${attempt}) to ${webhook.url}: ${errorMsg}`,
      );
      if (attempt < maxAttempts) {
        const timeoutId = `${webhook.id}-${attempt}`;
        const timeout = setTimeout(() => {
          this.timeouts.delete(timeoutId);
          void this.deliverWebhook(webhook, payload, attempt + 1);
        }, backoff);
        this.timeouts.set(timeoutId, timeout);
      } else {
        this.logger.error(
          `Webhook delivery permanently failed to ${webhook.url}`,
        );
      }
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
