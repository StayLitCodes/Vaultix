import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysService } from './api-key.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKey, ApiKeyScope } from './entities/api-key.entity';
import { Repository } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import * as apiKeyUtils from './utils/api-key.util';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let repo: jest.Mocked<Repository<ApiKey>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        {
          provide: getRepositoryToken(ApiKey),
          useValue: {
            create: jest.fn().mockImplementation((dto) => dto),
            save: jest.fn().mockImplementation((dto) =>
              Promise.resolve({
                ...dto,
                id: 'k1',
                createdAt: new Date(),
                updatedAt: new Date(),
              }),
            ),
            findOne: jest.fn(),
            find: jest.fn(),
            count: jest.fn(),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
    repo = module.get(getRepositoryToken(ApiKey));
  });

  describe('create', () => {
    it('should create and return raw key with scopes', async () => {
      repo.count.mockResolvedValue(0);
      const dto = {
        name: 'Test Key',
        scopes: [ApiKeyScope.READ_ESCROWS, ApiKeyScope.READ_ANALYTICS],
      };
      const result = await service.create('u1', dto);

      expect(result).toHaveProperty('key');
      expect(result.name).toBe('Test Key');
      expect(result.keyPrefix).toMatch(/^vlt_/);
      expect(result.scopes).toEqual(dto.scopes);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw when max active keys reached', async () => {
      repo.count.mockResolvedValue(5);
      const dto = {
        name: 'Test Key',
        scopes: [ApiKeyScope.READ_ESCROWS],
      };

      await expect(service.create('u1', dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle optional expiration date', async () => {
      repo.count.mockResolvedValue(0);
      const dto = {
        name: 'Test Key',
        scopes: [ApiKeyScope.READ_ESCROWS],
        expiresAt: '2025-12-31T23:59:59Z',
      };
      const result = await service.create('u1', dto);

      expect(result.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('findByRawKey', () => {
    it('should find by raw key hash', async () => {
      const mockKey = { id: 'k1', isActive: true, keyHash: 'hash' };
      repo.find.mockResolvedValue([mockKey as any]);

      jest.spyOn(apiKeyUtils, 'verifyKey').mockResolvedValue(true);

      const result = await service.findByRawKey('raw-key');
      expect(result).toBeDefined();
    });

    it('should return null for invalid key', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findByRawKey('invalid-key');
      expect(result).toBeNull();
    });
  });

  describe('list', () => {
    it('should return keys for user without sensitive data', async () => {
      const mockKeys = [
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
      repo.find.mockResolvedValue(mockKeys as any);

      const result = await service.list('u1');
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('keyHash');
      expect(result[0]).not.toHaveProperty('key');
    });
  });

  describe('findOne', () => {
    it('should return single key by id', async () => {
      const mockKey = {
        id: 'k1',
        userId: 'u1',
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
      repo.findOne.mockResolvedValue(mockKey as any);

      const result = await service.findOne('k1', 'u1');
      expect(result).toBeDefined();
      expect(result.id).toBe('k1');
    });

    it('should throw if key not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.findOne('k1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update key name and scopes', async () => {
      const mockKey = {
        id: 'k1',
        userId: 'u1',
        name: 'Old Name',
        scopes: [ApiKeyScope.READ_ESCROWS],
        isActive: true,
      };
      repo.findOne.mockResolvedValue(mockKey as any);

      const dto = {
        name: 'New Name',
        scopes: [ApiKeyScope.READ_ESCROWS, ApiKeyScope.WRITE_ESCROWS],
      };

      await service.update('k1', 'u1', dto);

      expect(mockKey.name).toBe('New Name');
      expect(mockKey.scopes).toEqual(dto.scopes);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw if key not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.update('k1', 'u1', { name: 'New' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('revoke', () => {
    it('should set active to false and add revokedAt', async () => {
      const mockKey = {
        id: 'k1',
        userId: 'u1',
        isActive: true,
        revokedAt: null as Date | null,
      };
      repo.findOne.mockResolvedValue(mockKey as any);

      await service.revoke('k1', 'u1');

      expect(mockKey.isActive).toBe(false);
      expect(mockKey.revokedAt).toBeInstanceOf(Date);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw if not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.revoke('k1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('rotate', () => {
    it('should create new key and deactivate old', async () => {
      const oldKey = {
        id: 'k1',
        userId: 'u1',
        name: 'Test Key',
        scopes: [ApiKeyScope.READ_ESCROWS],
        isActive: true,
        expiresAt: null,
        rateLimitPerMinute: 200,
        revokedAt: null as Date | null,
      };
      repo.findOne.mockResolvedValue(oldKey as any);
      repo.save.mockResolvedValueOnce(oldKey as any).mockResolvedValueOnce({
        ...oldKey,
        id: 'k2',
        createdAt: new Date(),
      } as any);

      const result = await service.rotate('k1', 'u1');

      expect(oldKey.isActive).toBe(false);
      expect(oldKey.revokedAt).toBeInstanceOf(Date);
      expect(result).toHaveProperty('key');
      expect(result.id).not.toBe('k1');
    });

    it('should throw if key not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.rotate('k1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateLastUsedAt', () => {
    it('should update lastUsedAt timestamp', async () => {
      repo.update.mockResolvedValue({} as any);

      await service.updateLastUsedAt('k1');

      expect(repo.update).toHaveBeenCalledWith('k1', {
        lastUsedAt: expect.any(Date),
      });
    });
  });

  describe('deactivateExpiredKeys', () => {
    it('should deactivate expired keys', async () => {
      const mockQueryBuilder = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 3 }),
      };
      repo.createQueryBuilder.mockReturnValue(mockQueryBuilder as any);

      const result = await service.deactivateExpiredKeys();

      expect(result).toBe(3);
      expect(mockQueryBuilder.execute).toHaveBeenCalled();
    });
  });
});
