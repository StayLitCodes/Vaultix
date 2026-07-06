import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeyController } from './api-key.controller';
import { ApiKeysService } from './api-key.service';
import { ApiRateLimitService } from './api-rate-limit.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { AuthGuard } from '../modules/auth/middleware/auth.guard';
import { AuthService } from '../modules/auth/services/auth.service';
import { ApiKeyScope } from './entities/api-key.entity';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ApiKeyController', () => {
  let controller: ApiKeyController;
  let service: jest.Mocked<ApiKeysService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [
        {
          provide: ApiKeysService,
          useValue: {
            create: jest.fn(),
            list: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            revoke: jest.fn(),
            rotate: jest.fn(),
          },
        },
        {
          provide: ApiRateLimitService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: ApiKeyGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: AuthGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: AuthService,
          useValue: {
            validateToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<ApiKeyController>(ApiKeyController);
    service = module.get(ApiKeysService);
  });

  describe('create', () => {
    it('should create an API key', async () => {
      const mockReq = { user: { sub: 'u1' } };
      const dto = {
        name: 'Test Key',
        scopes: [ApiKeyScope.READ_ESCROWS],
      };
      const expectedResult = {
        id: 'k1',
        name: 'Test Key',
        key: 'vlt_abc123',
        keyPrefix: 'vlt_abc',
        scopes: [ApiKeyScope.READ_ESCROWS],
        rateLimitPerMinute: 200,
        createdAt: new Date(),
      };

      service.create.mockResolvedValue(expectedResult as any);

      const result = await controller.create(mockReq as any, dto as any);

      expect(service.create).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(expectedResult);
    });

    it('should throw error when max keys reached', async () => {
      const mockReq = { user: { sub: 'u1' } };
      const dto = {
        name: 'Test Key',
        scopes: [ApiKeyScope.READ_ESCROWS],
      };

      service.create.mockRejectedValue(new BadRequestException('Max keys reached'));

      await expect(controller.create(mockReq as any, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('list', () => {
    it('should return list of API keys', async () => {
      const mockReq = { user: { sub: 'u1' } };
      const expectedKeys = [
        {
          id: 'k1',
          name: 'Key 1',
          keyPrefix: 'vlt_abc',
          scopes: [ApiKeyScope.READ_ESCROWS],
          isActive: true,
          lastUsedAt: new Date(),
          expiresAt: null,
          rateLimitPerMinute: 200,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      service.list.mockResolvedValue(expectedKeys as any);

      const result = await controller.list(mockReq as any);

      expect(service.list).toHaveBeenCalledWith('u1');
      expect(result).toEqual(expectedKeys);
    });
  });

  describe('findOne', () => {
    it('should return a single API key', async () => {
      const mockReq = { user: { sub: 'u1' } };
      const expectedKey = {
        id: 'k1',
        name: 'Key 1',
        keyPrefix: 'vlt_abc',
        scopes: [ApiKeyScope.READ_ESCROWS],
        isActive: true,
        lastUsedAt: new Date(),
        expiresAt: null,
        rateLimitPerMinute: 200,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.findOne.mockResolvedValue(expectedKey as any);

      const result = await controller.findOne(mockReq as any, 'k1');

      expect(service.findOne).toHaveBeenCalledWith('k1', 'u1');
      expect(result).toEqual(expectedKey);
    });

    it('should throw error if key not found', async () => {
      const mockReq = { user: { sub: 'u1' } };

      service.findOne.mockRejectedValue(new NotFoundException('Key not found'));

      await expect(controller.findOne(mockReq as any, 'k1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an API key', async () => {
      const mockReq = { user: { sub: 'u1' } };
      const dto = {
        name: 'Updated Name',
        scopes: [ApiKeyScope.READ_ESCROWS, ApiKeyScope.WRITE_ESCROWS],
      };
      const expectedKey = {
        id: 'k1',
        name: 'Updated Name',
        keyPrefix: 'vlt_abc',
        scopes: [ApiKeyScope.READ_ESCROWS, ApiKeyScope.WRITE_ESCROWS],
        isActive: true,
        lastUsedAt: new Date(),
        expiresAt: null,
        rateLimitPerMinute: 200,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      service.update.mockResolvedValue(expectedKey as any);

      const result = await controller.update(mockReq as any, 'k1', dto as any);

      expect(service.update).toHaveBeenCalledWith('k1', 'u1', dto);
      expect(result).toEqual(expectedKey);
    });
  });

  describe('revoke', () => {
    it('should revoke an API key', async () => {
      const mockReq = { user: { sub: 'u1' } };
      const expectedKey = {
        id: 'k1',
        name: 'Key 1',
        isActive: false,
        revokedAt: new Date(),
      };

      service.revoke.mockResolvedValue(expectedKey as any);

      const result = await controller.revoke(mockReq as any, 'k1');

      expect(service.revoke).toHaveBeenCalledWith('k1', 'u1');
      expect(result).toEqual(expectedKey);
    });

    it('should throw error if key not found', async () => {
      const mockReq = { user: { sub: 'u1' } };

      service.revoke.mockRejectedValue(new NotFoundException('Key not found'));

      await expect(controller.revoke(mockReq as any, 'k1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rotate', () => {
    it('should rotate an API key', async () => {
      const mockReq = { user: { sub: 'u1' } };
      const expectedKey = {
        id: 'k2',
        name: 'Key 1',
        key: 'vlt_newkey',
        keyPrefix: 'vlt_new',
        scopes: [ApiKeyScope.READ_ESCROWS],
        rateLimitPerMinute: 200,
        createdAt: new Date(),
      };

      service.rotate.mockResolvedValue(expectedKey as any);

      const result = await controller.rotate(mockReq as any, 'k1');

      expect(service.rotate).toHaveBeenCalledWith('k1', 'u1');
      expect(result).toEqual(expectedKey);
      expect(result).toHaveProperty('key');
    });

    it('should throw error if key not found', async () => {
      const mockReq = { user: { sub: 'u1' } };

      service.rotate.mockRejectedValue(new NotFoundException('Key not found'));

      await expect(controller.rotate(mockReq as any, 'k1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});