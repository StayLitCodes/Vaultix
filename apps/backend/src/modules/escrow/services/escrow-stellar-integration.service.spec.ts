import { Test, TestingModule } from '@nestjs/testing';
import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Escrow } from '../entities/escrow.entity';
import { Party } from '../entities/party.entity';
import { Condition } from '../entities/condition.entity';
import { StellarService } from '../../../services/stellar.service';
import { EscrowOperationsService } from '../../../services/stellar/escrow-operations';
import stellarConfig from '../../../config/stellar.config';

describe('EscrowStellarIntegrationService', () => {
  let service: EscrowStellarIntegrationService;
  let escrowRepo: jest.Mocked<any>;
  let stellarService: jest.Mocked<any>;
  let escrowOps: jest.Mocked<any>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowStellarIntegrationService,
        {
          provide: stellarConfig.KEY,
          useValue: { network: 'testnet' },
        },
        {
          provide: StellarService,
          useValue: {
            buildTransaction: jest.fn().mockResolvedValue({}),
            submitTransaction: jest.fn().mockResolvedValue({ hash: 'tx-hash' }),
            streamTransactions: jest.fn(),
          },
        },
        {
          provide: EscrowOperationsService,
          useValue: {
            createEscrowInitializationOps: jest.fn().mockReturnValue([]),
            createFundingOps: jest.fn().mockReturnValue([]),
            createMilestoneReleaseOps: jest.fn().mockReturnValue([]),
            createConfirmationOps: jest.fn().mockReturnValue([]),
            createCancelOps: jest.fn().mockReturnValue([]),
            createCompletionOps: jest.fn().mockReturnValue([]),
          },
        },
        {
          provide: getRepositoryToken(Escrow),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Party),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Condition),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<EscrowStellarIntegrationService>(
      EscrowStellarIntegrationService,
    );
    escrowRepo = module.get(getRepositoryToken(Escrow));
    stellarService = module.get(StellarService);
    escrowOps = module.get(EscrowOperationsService);
  });

  const mockEscrow = {
    id: 'e1',
    amount: 100,
    parties: [
      { role: 'buyer', user: { walletAddress: 'buyer-addr' } },
      { role: 'seller', user: { walletAddress: 'seller-addr' } },
    ],
    conditions: [{ description: 'c1' }],
    assetCode: 'XLM',
    assetIssuer: null,
    expiresAt: new Date(),
  };

  describe('createOnChainEscrow', () => {
    it('should build and submit transaction', async () => {
      escrowRepo.findOne.mockResolvedValue(mockEscrow);
      const hash = await service.createOnChainEscrow('e1');
      expect(hash).toBe('tx-hash');
      expect(stellarService.submitTransaction).toHaveBeenCalled();
    });

    it('should throw if escrow not found', async () => {
      escrowRepo.findOne.mockResolvedValue(null);
      await expect(service.createOnChainEscrow('e1')).rejects.toThrow(
        'not found',
      );
    });
  });

  describe('fundOnChainEscrow', () => {
    it('should fund successfully', async () => {
      const hash = await service.fundOnChainEscrow(
        'e1',
        'funder-pubkey',
        '100',
      );
      expect(hash).toBe('tx-hash');
      expect(escrowOps.createFundingOps).toHaveBeenCalledWith('e1');
    });
  });

  describe('releaseMilestonePayment', () => {
    it('should release payment successfully', async () => {
      const hash = await service.releaseMilestonePayment(
        'e1',
        0,
        'releaser-pubkey',
      );
      expect(hash).toBe('tx-hash');
      expect(escrowOps.createMilestoneReleaseOps).toHaveBeenCalledWith('e1', 0);
    });
  });

  describe('confirmEscrow', () => {
    it('should confirm successfully', async () => {
      const hash = await service.confirmEscrow('e1', 'confirmer-pubkey', 0);
      expect(hash).toBe('tx-hash');
      expect(escrowOps.createConfirmationOps).toHaveBeenCalledWith(
        'e1',
        'confirmer-pubkey',
        0,
      );
    });
  });

  describe('cancelOnChainEscrow', () => {
    it('should cancel successfully', async () => {
      const hash = await service.cancelOnChainEscrow('e1', 'canceller-pubkey');
      expect(hash).toBe('tx-hash');
      expect(escrowOps.createCancelOps).toHaveBeenCalledWith('e1');
    });
  });

  describe('completeOnChainEscrow', () => {
    it('should complete successfully', async () => {
      const hash = await service.completeOnChainEscrow(
        'e1',
        'completer-pubkey',
      );
      expect(hash).toBe('tx-hash');
      expect(escrowOps.createCompletionOps).toHaveBeenCalledWith('e1');
    });
  });

  describe('monitorOnChainEscrow', () => {
    it('should call streamTransactions', () => {
      const callback = jest.fn();
      service.monitorOnChainEscrow('e1', 'pubkey', callback);
      expect(stellarService.streamTransactions).toHaveBeenCalledWith(
        'pubkey',
        expect.any(Function),
      );
    });
  });
});
