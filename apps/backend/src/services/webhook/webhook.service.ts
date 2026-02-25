import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
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
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepo: Repository<Webhook>,
  ) {}

  async createWebhook(
    userId: string,
    url: string,
    secret: string,
    events: WebhookEvent[],
  ): Promise<Webhook> {
    // TODO: Add rate limiting logic here
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
        setTimeout(
          () => void this.deliverWebhook(webhook, payload, attempt + 1),
          backoff,
        );
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
