import { Test, TestingModule } from '@nestjs/testing';
import { ApiKeysService } from './api-key.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKey } from './entities/api-key.entity';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';

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
            save: jest
              .fn()
              .mockImplementation((dto) =>
                Promise.resolve({ ...dto, id: 'k1', createdAt: new Date() }),
              ),
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ApiKeysService>(ApiKeysService);
    repo = module.get(getRepositoryToken(ApiKey));
  });

  describe('create', () => {
    it('should create and return raw key', async () => {
      const result = await service.create('u1', { name: 'Test Key' });
      expect(result).toHaveProperty('key');
      expect(result.name).toBe('Test Key');
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('findByRawKey', () => {
    it('should find by hash', async () => {
      repo.findOne.mockResolvedValue({ id: 'k1' } as any);
      const result = await service.findByRawKey('raw-key');
      expect(repo.findOne).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('list', () => {
    it('should return keys for user', async () => {
      repo.find.mockResolvedValue([{ id: 'k1' }] as any);
      const result = await service.list('u1');
      expect(result).toHaveLength(1);
    });
  });

  describe('revoke', () => {
    it('should set active to false', async () => {
      const mockKey = { id: 'k1', ownerUserId: 'u1', active: true };
      repo.findOne.mockResolvedValue(mockKey as any);

      await service.revoke('k1', 'u1');

      expect(mockKey.active).toBe(false);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.revoke('k1', 'u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
