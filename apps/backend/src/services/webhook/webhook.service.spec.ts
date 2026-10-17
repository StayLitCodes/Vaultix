import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Webhook } from '../../modules/webhook/webhook.entity';
import { WebhookDelivery } from '../../modules/webhook/entities/webhook-delivery.entity';
import { WebhookDeadLetter } from '../../modules/webhook/entities/webhook-dead-letter.entity';
import { Repository } from 'typeorm';
import axios from 'axios';
import { WebhookDeliveryStatus } from '../../types/webhook/webhook.types';
import {
  NotFoundException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('WebhookService', () => {
  let service: WebhookService;
  let webhookRepo: jest.Mocked<Repository<Webhook>>;
  let deliveryRepo: jest.Mocked<Repository<WebhookDelivery>>;
  let deadLetterRepo: jest.Mocked<Repository<WebhookDeadLetter>>;

  const configValues: Record<string, unknown> = {
    'webhook.maxAttempts': 6,
    'webhook.retryScheduleMs': [
      60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 86_400_000,
    ],
    'webhook.requestTimeoutMs': 30_000,
    'webhook.alertFailureRateThreshold': 25,
    'webhook.alertMinDeliveries': 10,
    'webhook.alertWindowMinutes': 60,
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookService,
        {
          provide: getRepositoryToken(Webhook),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WebhookDelivery),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            delete: jest.fn(),
            findAndCount: jest.fn(),
            count: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(WebhookDeadLetter),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            findAndCount: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: unknown) =>
                configValues[key] ?? defaultValue,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    webhookRepo = module.get(getRepositoryToken(Webhook));
    deliveryRepo = module.get(getRepositoryToken(WebhookDelivery));
    deadLetterRepo = module.get(getRepositoryToken(WebhookDeadLetter));
  });

  const mockWebhook = {
    id: 'w1',
    user: { id: 'u1' },
    url: 'http://test.com',
    secret: 'test-secret',
    events: ['escrow.created'],
    isActive: true,
  };

  describe('createWebhook', () => {
    it('should create a webhook if within limits', async () => {
      webhookRepo.find.mockResolvedValue([]);
      webhookRepo.create.mockReturnValue(mockWebhook as any);
      webhookRepo.save.mockResolvedValue(mockWebhook as any);

      const result = await service.createWebhook('u1', 'test.com', 'secret', [
        'escrow.created',
      ]);

      expect(webhookRepo.save).toHaveBeenCalled();
      expect(result).toEqual(mockWebhook);
    });

    it('should throw if too many events', async () => {
      await expect(
        service.createWebhook(
          'u1',
          'test.com',
          'secret',
          Array(10).fill('escrow.created') as any,
        ),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw if user exceeds webhook limit', async () => {
      webhookRepo.find.mockResolvedValue(Array(11).fill(mockWebhook) as any);
      await expect(
        service.createWebhook('u1', 'test.com', 'secret', ['escrow.created']),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('deleteWebhook', () => {
    it('should delete if owned by user', async () => {
      webhookRepo.findOne.mockResolvedValue(mockWebhook as any);
      await service.deleteWebhook('u1', 'w1');
      expect(webhookRepo.delete).toHaveBeenCalledWith('w1');
    });

    it('should throw if not owned by user', async () => {
      webhookRepo.findOne.mockResolvedValue({
        id: 'w1',
        user: { id: 'u2' },
      } as any);
      await expect(service.deleteWebhook('u1', 'w1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if webhook not found', async () => {
      webhookRepo.findOne.mockResolvedValue(null);
      await expect(service.deleteWebhook('u1', 'w1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('dispatchEvent', () => {
    it('should create a delivery record and attempt delivery for matching webhooks', async () => {
      webhookRepo.find.mockResolvedValue([mockWebhook] as any);
      const mockDelivery = {
        id: 'd1',
        webhookId: 'w1',
        webhook: mockWebhook,
        event: 'escrow.created',
        payload: {
          event: 'escrow.created',
          data: { foo: 'bar' },
          timestamp: expect.any(String),
        },
        status: WebhookDeliveryStatus.PENDING,
        attempt: 1,
        maxAttempts: 6,
        nextRetryAt: expect.any(Date),
        lastStatusCode: null,
        lastError: null,
        lastAttemptAt: null,
      };
      deliveryRepo.create.mockReturnValue(mockDelivery as any);
      deliveryRepo.save.mockResolvedValue(mockDelivery as any);

      const attemptSpy = jest
        .spyOn(service, 'attemptDelivery')
        .mockImplementation(() => Promise.resolve());

      await service.dispatchEvent('escrow.created', { foo: 'bar' });

      expect(deliveryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: 'w1',
          event: 'escrow.created',
          status: WebhookDeliveryStatus.PENDING,
          attempt: 1,
          maxAttempts: 6,
        }),
      );
      expect(deliveryRepo.save).toHaveBeenCalled();
      expect(attemptSpy).toHaveBeenCalledWith(mockDelivery);
    });

    it('should not create delivery for webhooks that do not match the event', async () => {
      const nonMatchingWebhook = { ...mockWebhook, events: ['escrow.funded'] };
      webhookRepo.find.mockResolvedValue([nonMatchingWebhook] as any);

      await service.dispatchEvent('escrow.created', { foo: 'bar' });

      expect(deliveryRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('attemptDelivery', () => {
    const baseDelivery = {
      id: 'd1',
      webhookId: 'w1',
      webhook: mockWebhook,
      event: 'escrow.created',
      payload: { event: 'escrow.created', data: {}, timestamp: 'now' },
      status: WebhookDeliveryStatus.PENDING,
      attempt: 1,
      maxAttempts: 6,
      nextRetryAt: new Date(),
      lastStatusCode: null,
      lastError: null,
      lastAttemptAt: null,
    };

    it('should mark as delivered on success with a 30s request timeout', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });
      const delivery = { ...baseDelivery };
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));

      await service.attemptDelivery(delivery as any);

      expect(delivery.status).toBe(WebhookDeliveryStatus.DELIVERED);
      expect(delivery.lastStatusCode).toBe(200);
      expect(delivery.lastError).toBeNull();
      expect(delivery.nextRetryAt).toBeNull();
      expect(delivery.lastAttemptAt).toBeInstanceOf(Date);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        mockWebhook.url,
        expect.anything(),
        expect.objectContaining({ timeout: 30_000 }),
      );
    });

    it('should set status to retrying on failure with attempts remaining', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));
      const delivery = { ...baseDelivery, attempt: 1 };
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));

      await service.attemptDelivery(delivery as any);

      expect(delivery.status).toBe(WebhookDeliveryStatus.RETRYING);
      expect(delivery.attempt).toBe(2);
      expect(delivery.lastError).toBe('Network error');
      expect(delivery.nextRetryAt).toBeInstanceOf(Date);
    });

    it('should schedule retry 1 minute out for attempt 1', async () => {
      mockedAxios.post.mockRejectedValue(new Error('fail'));
      const delivery = { ...baseDelivery, attempt: 1 };
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));
      const before = Date.now();

      await service.attemptDelivery(delivery as any);

      const backoffMs = delivery.nextRetryAt.getTime() - before;
      expect(backoffMs).toBeGreaterThanOrEqual(59_000);
      expect(backoffMs).toBeLessThanOrEqual(61_000);
    });

    it('should schedule retry 5 minutes out for attempt 2', async () => {
      mockedAxios.post.mockRejectedValue(new Error('fail'));
      const delivery = { ...baseDelivery, attempt: 2 };
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));
      const before = Date.now();

      await service.attemptDelivery(delivery as any);

      const backoffMs = delivery.nextRetryAt.getTime() - before;
      expect(backoffMs).toBeGreaterThanOrEqual(299_000);
      expect(backoffMs).toBeLessThanOrEqual(301_000);
    });

    it('should schedule retry 30 minutes out for attempt 3', async () => {
      mockedAxios.post.mockRejectedValue(new Error('fail'));
      const delivery = { ...baseDelivery, attempt: 3 };
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));
      const before = Date.now();

      await service.attemptDelivery(delivery as any);

      const backoffMs = delivery.nextRetryAt.getTime() - before;
      expect(backoffMs).toBeGreaterThanOrEqual(1_799_000);
      expect(backoffMs).toBeLessThanOrEqual(1_801_000);
    });

    it('should move to dead letter queue when max attempts exhausted', async () => {
      mockedAxios.post.mockRejectedValue(new Error('Network error'));
      const delivery = { ...baseDelivery, attempt: 6 };
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));
      deadLetterRepo.create.mockImplementation((input) => input as any);
      deadLetterRepo.save.mockImplementation((d) => Promise.resolve(d as any));

      await service.attemptDelivery(delivery as any);

      expect(delivery.status).toBe(WebhookDeliveryStatus.DEAD_LETTERED);
      expect(delivery.nextRetryAt).toBeNull();
      expect(delivery.lastError).toBe('Network error');
      expect(deadLetterRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: 'w1',
          originalDeliveryId: 'd1',
          event: 'escrow.created',
          attempts: 6,
          lastError: 'Network error',
        }),
      );
      expect(deadLetterRepo.save).toHaveBeenCalled();
    });

    it('should capture HTTP status code from error response', async () => {
      const axiosError = {
        response: { status: 500 },
        message: 'Request failed with status code 500',
      };
      mockedAxios.post.mockRejectedValue(axiosError);
      const delivery = { ...baseDelivery, attempt: 1 };
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));

      await service.attemptDelivery(delivery as any);

      expect(delivery.lastStatusCode).toBe(500);
    });

    it('should mark as failed if webhook entity no longer exists', async () => {
      const delivery = { ...baseDelivery, webhook: undefined, webhookId: 'w1' };
      webhookRepo.findOne.mockResolvedValue(null);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));

      await service.attemptDelivery(delivery as any);

      expect(delivery.status).toBe(WebhookDeliveryStatus.FAILED);
      expect(delivery.lastError).toBe('Webhook not found');
    });
  });

  describe('processRetries', () => {
    it('should pick up retrying deliveries with past nextRetryAt', async () => {
      const dueDeliveries = [
        { id: 'd1', status: WebhookDeliveryStatus.RETRYING },
      ];
      deliveryRepo.find.mockResolvedValue(dueDeliveries as any);

      const attemptSpy = jest
        .spyOn(service, 'attemptDelivery')
        .mockImplementation(() => Promise.resolve());

      await service.processRetries();

      expect(deliveryRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: WebhookDeliveryStatus.RETRYING,
            nextRetryAt: expect.anything(),
          },
        }),
      );
      expect(attemptSpy).toHaveBeenCalledWith(dueDeliveries[0]);
    });
  });

  describe('processPending', () => {
    it('should pick up pending deliveries with past nextRetryAt', async () => {
      const pendingDeliveries = [
        { id: 'd2', status: WebhookDeliveryStatus.PENDING },
      ];
      deliveryRepo.find.mockResolvedValue(pendingDeliveries as any);

      const attemptSpy = jest
        .spyOn(service, 'attemptDelivery')
        .mockImplementation(() => Promise.resolve());

      await service.processPending();

      expect(deliveryRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            status: WebhookDeliveryStatus.PENDING,
            nextRetryAt: expect.anything(),
          },
        }),
      );
      expect(attemptSpy).toHaveBeenCalledWith(pendingDeliveries[0]);
    });
  });

  describe('getFailedDeliveries', () => {
    it('should return paginated failed deliveries', async () => {
      const failedDeliveries = [
        { id: 'd1', status: WebhookDeliveryStatus.FAILED },
      ];
      deliveryRepo.findAndCount.mockResolvedValue([failedDeliveries as any, 1]);

      const result = await service.getFailedDelveys({ page: 1, limit: 20 });

      expect(result.deliveries).toEqual(failedDeliveries);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      });
    });
  });

  describe('manualRetry', () => {
    it('should reset a failed delivery and re-attempt', async () => {
      const failedDelivery = {
        id: 'd1',
        status: WebhookDeliveryStatus.FAILED,
        attempt: 5,
        nextRetryAt: null,
        lastStatusCode: 500,
        lastError: 'Internal Server Error',
        lastAttemptAt: new Date(),
        webhook: mockWebhook,
      };
      deliveryRepo.findOne.mockResolvedValue(failedDelivery as any);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));
      const attemptSpy = jest
        .spyOn(service, 'attemptDelivery')
        .mockImplementation(() => Promise.resolve());

      const result = await service.manualRetry('d1');

      expect(result.status).toBe(WebhookDeliveryStatus.PENDING);
      expect(result.attempt).toBe(1);
      expect(result.lastStatusCode).toBeNull();
      expect(result.lastError).toBeNull();
      expect(attemptSpy).toHaveBeenCalled();
    });

    it('should throw if delivery not found', async () => {
      deliveryRepo.findOne.mockResolvedValue(null);
      await expect(service.manualRetry('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if delivery is not in failed status', async () => {
      deliveryRepo.findOne.mockResolvedValue({
        id: 'd1',
        status: WebhookDeliveryStatus.DELIVERED,
      } as any);
      await expect(service.manualRetry('d1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getHealthStats', () => {
    it('should return correct health stats', async () => {
      deliveryRepo.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);

      const result = await service.getHealthStats();

      expect(result).toEqual({
        total: 100,
        delivered: 80,
        failed: 5,
        retrying: 5,
        pending: 5,
        deadLettered: 5,
        successRate: 88.89,
        failureRate: 11.11,
      });
    });

    it('should return zero rates when no completed deliveries exist', async () => {
      deliveryRepo.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(0);

      const result = await service.getHealthStats();

      expect(result.successRate).toBe(0);
      expect(result.failureRate).toBe(0);
    });
  });

  describe('getDeadLetters', () => {
    it('should return paginated dead letters', async () => {
      const deadLetters = [{ id: 'dl1', webhookId: 'w1' }];
      deadLetterRepo.findAndCount.mockResolvedValue([deadLetters as any, 1]);

      const result = await service.getDeadLetters({ page: 1, limit: 20 });

      expect(result.deadLetters).toEqual(deadLetters);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        pages: 1,
      });
    });
  });

  describe('replayDeadLetter', () => {
    it('should create a fresh delivery and mark the dead letter as replayed', async () => {
      const deadLetter = {
        id: 'dl1',
        webhookId: 'w1',
        webhook: mockWebhook,
        event: 'escrow.created',
        payload: { event: 'escrow.created', data: {}, timestamp: 'now' },
        attempts: 6,
        replayedAt: null,
      };
      deadLetterRepo.findOne.mockResolvedValue(deadLetter as any);
      deadLetterRepo.save.mockImplementation((d) => Promise.resolve(d as any));
      deliveryRepo.create.mockImplementation((input) => input as any);
      deliveryRepo.save.mockImplementation((d) => Promise.resolve(d as any));
      const attemptSpy = jest
        .spyOn(service, 'attemptDelivery')
        .mockImplementation(() => Promise.resolve());

      const result = await service.replayDeadLetter('dl1');

      expect(deliveryRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          webhookId: 'w1',
          event: 'escrow.created',
          status: WebhookDeliveryStatus.PENDING,
          attempt: 1,
          maxAttempts: 6,
        }),
      );
      expect(deadLetter.replayedAt).toBeInstanceOf(Date);
      expect(attemptSpy).toHaveBeenCalled();
      expect(result.status).toBe(WebhookDeliveryStatus.PENDING);
    });

    it('should throw if dead letter not found', async () => {
      deadLetterRepo.findOne.mockResolvedValue(null);
      await expect(service.replayDeadLetter('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw if the webhook no longer exists', async () => {
      deadLetterRepo.findOne.mockResolvedValue({
        id: 'dl1',
        webhookId: 'w1',
        webhook: undefined,
      } as any);
      webhookRepo.findOne.mockResolvedValue(null);

      await expect(service.replayDeadLetter('dl1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getMetrics', () => {
    it('should return delivery metrics including retry and dead letter counts', async () => {
      deliveryRepo.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(80)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(5);
      deliveryRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalRetries: '17' }),
      } as any);
      deadLetterRepo.count.mockResolvedValueOnce(5).mockResolvedValueOnce(3);

      const result = await service.getMetrics();

      expect(result.deliveries.total).toBe(100);
      expect(result.successRate).toBe(88.89);
      expect(result.totalRetries).toBe(17);
      expect(result.deadLetterCount).toBe(5);
      expect(result.unreplayedDeadLetterCount).toBe(3);
      expect(result.lastAlert).toBeNull();
    });
  });

  describe('checkFailureRateAlert', () => {
    it('should record an alert when failure rate exceeds the threshold', async () => {
      // 10 delivered, 10 failed in window => 50% failure rate >= 25%
      deliveryRepo.count.mockResolvedValueOnce(10).mockResolvedValueOnce(10);

      await service.checkFailureRateAlert();

      const metricsAlert = (service as any).lastAlert;
      expect(metricsAlert).not.toBeNull();
      expect(metricsAlert.failureRate).toBe(50);
    });

    it('should not alert when there are too few deliveries in the window', async () => {
      deliveryRepo.count.mockResolvedValueOnce(2).mockResolvedValueOnce(2);

      await service.checkFailureRateAlert();

      expect((service as any).lastAlert).toBeNull();
    });

    it('should not alert when the failure rate is below the threshold', async () => {
      deliveryRepo.count.mockResolvedValueOnce(95).mockResolvedValueOnce(5);

      await service.checkFailureRateAlert();

      expect((service as any).lastAlert).toBeNull();
    });
  });

  describe('verifySignature', () => {
    it('should verify signature correctly', () => {
      const payload: any = { foo: 'bar' };
      const secret = 'test-secret';
      const signature = service.signPayload(secret, payload);
      const isValid = service.verifySignature(secret, payload, signature);
      expect(isValid).toBe(true);
    });

    it('should reject signatures with mismatched length', () => {
      const payload: any = { foo: 'bar' };
      expect(service.verifySignature('test-secret', payload, 'short')).toBe(
        false,
      );
    });

    it('should reject tampered signatures', () => {
      const payload: any = { foo: 'bar' };
      const signature = service.signPayload('test-secret', payload);
      const tampered =
        signature.slice(0, -1) + (signature.endsWith('0') ? '1' : '0');
      expect(service.verifySignature('test-secret', payload, tampered)).toBe(
        false,
      );
    });
  });
});
