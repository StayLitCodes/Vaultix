import { Test, TestingModule } from '@nestjs/testing';
import { WebhookService } from './webhook.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Webhook } from '../../modules/webhook/webhook.entity';
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
  let repo: jest.Mocked<Repository<Webhook>>;

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
      ],
    }).compile();

    service = module.get<WebhookService>(WebhookService);
    repo = module.get(getRepositoryToken(Webhook));
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
      repo.find.mockResolvedValue([]);
      repo.create.mockReturnValue(mockWebhook as any);
      repo.save.mockResolvedValue(mockWebhook as any);

      const result = await service.createWebhook('u1', 'test.com', 'secret', [
        'escrow.created',
      ]);

      expect(repo.save).toHaveBeenCalled();
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
      repo.find.mockResolvedValue(Array(11).fill(mockWebhook) as any);
      await expect(
        service.createWebhook('u1', 'test.com', 'secret', ['escrow.created']),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('deleteWebhook', () => {
    it('should delete if owned by user', async () => {
      repo.findOne.mockResolvedValue(mockWebhook as any);
      await service.deleteWebhook('u1', 'w1');
      expect(repo.delete).toHaveBeenCalledWith('w1');
    });

    it('should throw if not owned by user', async () => {
      repo.findOne.mockResolvedValue({ id: 'w1', user: { id: 'u2' } } as any);
      await expect(service.deleteWebhook('u1', 'w1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if webhook not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.deleteWebhook('u1', 'w1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('dispatchEvent', () => {
    it('should call deliverWebhook for each active webhook with matching event', async () => {
      repo.find.mockResolvedValue([mockWebhook] as any);
      const deliverSpy = jest
        .spyOn(service, 'deliverWebhook')
        .mockReturnValue(Promise.resolve());

      await service.dispatchEvent('escrow.created', { foo: 'bar' });

      expect(deliverSpy).toHaveBeenCalledWith(
        mockWebhook,
        expect.objectContaining({ event: 'escrow.created' }),
      );
    });
  });

  describe('deliverWebhook', () => {
    it('should post payload and log success', async () => {
      mockedAxios.post.mockResolvedValue({ status: 200 });

      await service.deliverWebhook(mockWebhook as any, {
        event: 'escrow.created',
        data: {},
        timestamp: 'now',
      });

      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should retry on failure', async () => {
      const loggerWarn = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => {});
      mockedAxios.post.mockRejectedValue(new Error('Network error'));
      jest.useFakeTimers();

      const deliverSpy = jest.spyOn(service, 'deliverWebhook');
      await service.deliverWebhook(mockWebhook as any, {} as any, 1);

      expect(loggerWarn).toHaveBeenCalled();
      jest.runAllTimers();
      expect(deliverSpy).toHaveBeenCalledWith(
        mockWebhook,
        expect.anything(),
        2,
      );
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
