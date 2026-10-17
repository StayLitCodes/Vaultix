import { WebhookController } from './webhook.controller';
import { WebhookService } from '../../services/webhook/webhook.service';

describe('WebhookController', () => {
  const webhookService = {
    createWebhook: jest.fn(),
    getUserWebhooks: jest.fn(),
    rotateWebhookSecret: jest.fn(),
  } as unknown as jest.Mocked<WebhookService>;
  const controller = new WebhookController(webhookService);

  beforeEach(() => jest.clearAllMocks());

  it('does not expose endpoint secrets from the list route', async () => {
    webhookService.getUserWebhooks = jest.fn().mockResolvedValue([
      {
        id: 'webhook-1',
        url: 'https://receiver.example/hooks',
        secret: 'private-current-secret',
        previousSecret: 'private-previous-secret',
        events: ['escrow.created'],
        isActive: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]) as any;

    const result = await controller.list({ user: { id: 'user-1' } });

    expect(result).toEqual([
      expect.objectContaining({ id: 'webhook-1' }),
    ]);
    expect(result[0]).not.toHaveProperty('secret');
    expect(result[0]).not.toHaveProperty('previousSecret');
  });

  it('rotates a secret for the authenticated endpoint owner', async () => {
    const rotation = {
      secret: 'new-secret',
      previousSecretExpiresAt: new Date(Date.now() + 86_400_000),
    };
    webhookService.rotateWebhookSecret = jest
      .fn()
      .mockResolvedValue(rotation) as any;

    await expect(
      controller.rotateSecret({ user: { id: 'user-1' } }, 'webhook-1'),
    ).resolves.toEqual(rotation);
    expect(webhookService.rotateWebhookSecret).toHaveBeenCalledWith(
      'user-1',
      'webhook-1',
    );
  });
});