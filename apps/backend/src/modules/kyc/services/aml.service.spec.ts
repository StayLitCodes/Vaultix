import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AmlService } from './aml.service';
import { User } from '../../user/entities/user.entity';
import { MockAmlProvider } from '../providers/mock-aml.provider';

describe('AmlService', () => {
  let service: AmlService;
  let userRepo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const mockUserRepo = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AmlService,
        MockAmlProvider,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<AmlService>(AmlService);
    userRepo = module.get(getRepositoryToken(User));
  });

  describe('screenAddress', () => {
    it('should return low risk for a normal address', async () => {
      const result = await service.screenAddress(
        'GB6PSTVL2LVJFCLNNCSYK2X5QOE7SU4GERDLXUKNX3QLMHHR2QYGCFMB',
      );

      expect(result.flagged).toBe(false);
      expect(result.riskLevel).toBe('low');
    });

    it('should flag known risky addresses', async () => {
      const result = await service.screenAddress(
        'GBS4T7FEI5JUZP7ZLHREAVHXKDHGTVRWCTQQ7HTM3UAGLNYXZUCJ4CZN',
      );

      expect(result.flagged).toBe(true);
      expect(result.riskLevel).toBe('high');
      expect(result.sanctionsLists).toContain('OFAC_SDN_LIST');
    });

    it('should cache results', async () => {
      const address = 'GATEST1234567890123456789012345678901234567890123456789012';

      const result1 = await service.screenAddress(address);
      const result2 = await service.screenAddress(address);

      expect(result1).toEqual(result2);
    });
  });

  describe('screenUser', () => {
    it('should screen a user by their wallet address', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 'user-1',
        walletAddress: 'GABCDEF1234567890',
      } as User);

      const result = await service.screenUser('user-1');

      expect(result.flagged).toBe(false);
      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
        }),
      );
    });

    it('should return clean result for non-existent user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      const result = await service.screenUser('non-existent');

      expect(result.flagged).toBe(false);
      expect(result.riskLevel).toBe('low');
      expect(result.reason).toBe('User not found');
    });
  });

  describe('screenTransactionParties', () => {
    it('should screen multiple addresses and return true if all pass', async () => {
      const addresses = [
        'GTRANSACT1TEST12345678901234567890123456789012345678901234',
        'GTRANSACT2TEST12345678901234567890123456789012345678901234',
      ];

      const result = await service.screenTransactionParties(addresses);

      expect(result.passed).toBe(true);
      expect(Object.keys(result.results)).toHaveLength(2);
    });

    it('should return false if any address is flagged', async () => {
      const addresses = [
        'GTRANSACT1TEST12345678901234567890123456789012345678901234',
        'GBS4T7FEI5JUZP7ZLHREAVHXKDHGTVRWCTQQ7HTM3UAGLNYXZUCJ4CZN',
      ];

      const result = await service.screenTransactionParties(addresses);

      expect(result.passed).toBe(false);
    });
  });
});
