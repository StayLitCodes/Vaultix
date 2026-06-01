import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Webhook } from '../../modules/webhook/webhook.entity';
import { WebhookDelivery } from '../../modules/webhook/webhook-delivery.entity';
import { Repository } from 'typeorm';
import axios from 'axios';
import { WebhookEvent } from '../../types/webhook/webhook.types';
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

  beforeEach(async () => {
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
            count: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    webhookRepo = module.get(getRepositoryToken(Webhook));
    deliveryRepo = module.get(getRepositoryToken(WebhookDelivery));
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
      webhookRepo.findOne.mockResolvedValue({ id: 'w1', user: { id: 'u2' } } as any);
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
    it('should create a delivery and call deliverWebhook', async () => {
      webhookRepo.find.mockResolvedValue([mockWebhook] as any);
      deliveryRepo.create.mockReturnValue({ id: 'd1' } as any);
      deliveryRepo.save.mockResolvedValue({ id: 'd1' } as any);
      
      const deliverSpy = jest.spyOn(service, 'deliverWebhook').mockReturnValue(Promise.resolve());

      await service.dispatchEvent('escrow.created', { foo: 'bar' });

      expect(deliveryRepo.create).toHaveBeenCalled();
      expect(deliveryRepo.save).toHaveBeenCalled();
      expect(deliverSpy).toHaveBeenCalledWith('d1');
    });
  });

  describe('deliverWebhook', () => {
    it('should post payload and mark as delivered', async () => {
      const mockDelivery = {
        id: 'd1',
        webhook: mockWebhook,
        payload: { event: 'escrow.created', data: {} },
        attempts: 0,
        status: 'pending',
      };
      deliveryRepo.findOne.mockResolvedValue(mockDelivery as any);
      mockedAxios.post.mockResolvedValue({ status: 200 });

      await service.deliverWebhook('d1');

      expect(mockedAxios.post).toHaveBeenCalled();
      expect(mockDelivery.status).toBe('delivered');
      expect(deliveryRepo.save).toHaveBeenCalledWith(mockDelivery);
    });

    it('should retry on failure', async () => {
      const loggerWarn = jest.spyOn((service as any).logger, 'warn').mockImplementation(() => {});
      const mockDelivery = {
        id: 'd1',
        webhook: mockWebhook,
        payload: { event: 'escrow.created', data: {} },
        attempts: 0,
        status: 'pending',
      };
      deliveryRepo.findOne.mockResolvedValue(mockDelivery as any);
      mockedAxios.post.mockRejectedValue(new Error('Network error'));
      jest.useFakeTimers();

      const deliverSpy = jest.spyOn(service, 'deliverWebhook');
      await service.deliverWebhook('d1');

      expect(loggerWarn).toHaveBeenCalled();
      expect(mockDelivery.status).toBe('retrying');
      
      jest.runAllTimers();
      expect(deliverSpy).toHaveBeenCalledWith('d1');
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
  });
});
