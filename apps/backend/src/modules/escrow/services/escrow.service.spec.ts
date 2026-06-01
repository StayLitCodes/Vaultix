import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { Readable } from 'stream';

import { EscrowService } from './escrow.service';
import { Escrow, EscrowStatus, EscrowType } from '../entities/escrow.entity';
import { Party, PartyRole, PartyStatus } from '../entities/party.entity';
import { Condition, ConditionType } from '../entities/condition.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import {
  Dispute,
  DisputeStatus,
  DisputeOutcome,
} from '../entities/dispute.entity';

import { FulfillConditionDto } from '../dto/fulfill-condition.dto';
import { CreateEscrowDto } from '../dto/create-escrow.dto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { WebhookService } from '../../../services/webhook/webhook.service';
import { IpfsService } from '../../ipfs/ipfs.service';
import { AllowedAsset } from '../../assets/entities/allowed-asset.entity';
import { User, UserRole } from '../../user/entities/user.entity';

// ✅ FIX: missing services
import { EscrowLifecycleService } from '../escrow-lifecycle.service';
import { EscrowFundingService } from '../escrow-funding.service';
import { EscrowDisputeService } from '../escrow-dispute.service';
import { EscrowQueryService } from '../escrow-query.service';
import { StellarService } from '../../../services/stellar.service';

describe('EscrowService', () => {
  let service: EscrowService;
  let escrowRepository: jest.Mocked<Repository<Escrow>>;
  let partyRepository: jest.Mocked<Repository<Party>>;
  let conditionRepository: jest.Mocked<Repository<Condition>>;
  let eventRepository: jest.Mocked<Repository<EscrowEvent>>;
  let disputeRepository: jest.Mocked<Repository<Dispute>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let assetRepository: jest.Mocked<Repository<AllowedAsset>>;

  let ipfsService: {
    uploadFile: jest.Mock;
    getGatewayUrl: jest.Mock;
    getFileStream: jest.Mock;
  };
  let webhookService: { dispatchEvent: jest.Mock };

  // ✅ NEW MOCKS
  let lifecycleService: {
    create: jest.Mock;
    cancel: jest.Mock;
    expire: jest.Mock;
  };

  let fundingService: {
    fund: jest.Mock;
  };

  let disputeService: {
    fileDispute: jest.Mock;
    resolveDispute: jest.Mock;
  };

  let queryService: {
    findOverview: jest.Mock;
  };

  const mockEscrow: Partial<Escrow> = {
    id: 'escrow-123',
    title: 'Test Escrow',
    amount: 100,
    status: EscrowStatus.PENDING,
    type: EscrowType.STANDARD,
    creatorId: 'user-123',
    parties: [],
    conditions: [],
    events: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockParty: Partial<Party> = {
    id: 'party-123',
    escrowId: 'escrow-123',
    userId: 'user-456',
    role: PartyRole.SELLER,
    status: PartyStatus.PENDING,
    createdAt: new Date(),
  };

  const mockCondition: Partial<Condition> = {
    id: 'condition-123',
    escrowId: 'escrow-123',
    description: 'Delivery confirmed',
    type: ConditionType.MANUAL,
    isFulfilled: false,
    isMet: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    // ---------------- MOCK REPOS ----------------
    const mockEscrowRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      createQueryBuilder: jest.fn(),
    };

    const mockPartyRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const mockConditionRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockEventRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockDisputeRepo = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    };

    const mockUserRepo = {
      findOne: jest.fn(),
    };

    const mockAssetRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
    };

    const mockIpfsService = {
      uploadFile: jest.fn().mockResolvedValue('mock-cid'),
      getGatewayUrl: jest.fn().mockReturnValue('https://ipfs.io/ipfs/mock-cid'),
      getFileStream: jest.fn().mockResolvedValue({
        stream: Readable.from(['file-bytes']),
        contentType: 'application/pdf',
        contentLength: 10,
      }),
    };

    // ---------------- NEW SERVICE MOCKS ----------------
    const mockEscrowLifecycleService = {
      create: jest.fn(),
      cancel: jest.fn(),
      expire: jest.fn(),
    };

    const mockFundingService = {
      fund: jest.fn(),
    };

    const mockDisputeService = {
      fileDispute: jest.fn(),
      resolveDispute: jest.fn(),
    };

    const mockQueryService = {
      findOverview: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: getRepositoryToken(Escrow), useValue: mockEscrowRepo },
        { provide: getRepositoryToken(Party), useValue: mockPartyRepo },
        { provide: getRepositoryToken(Condition), useValue: mockConditionRepo },
        { provide: getRepositoryToken(EscrowEvent), useValue: mockEventRepo },
        { provide: getRepositoryToken(Dispute), useValue: mockDisputeRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(AllowedAsset), useValue: mockAssetRepo },

        { provide: IpfsService, useValue: mockIpfsService },

        {
          provide: EscrowStellarIntegrationService,
          useValue: {
            completeOnChainEscrow: jest.fn(),
            fundOnChainEscrow: jest.fn(),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            dispatchEvent: jest.fn(),
          },
        },

        // ✅ CRITICAL FIXES
        {
          provide: EscrowLifecycleService,
          useValue: mockEscrowLifecycleService,
        },
        {
          provide: EscrowFundingService,
          useValue: mockFundingService,
        },
        {
          provide: EscrowDisputeService,
          useValue: mockDisputeService,
        },
        {
          provide: EscrowQueryService,
          useValue: mockQueryService,
        },
        {
          provide: StellarService,
          useValue: {
            getAccount: jest.fn().mockResolvedValue({
              balances: [{ asset_type: 'native', balance: '1000' }],
            }),
          },
        },
      ],
    }).compile();

    // ---------------- ASSIGN ----------------
    service = module.get(EscrowService);

    escrowRepository = module.get(getRepositoryToken(Escrow));
    partyRepository = module.get(getRepositoryToken(Party));
    conditionRepository = module.get(getRepositoryToken(Condition));
    eventRepository = module.get(getRepositoryToken(EscrowEvent));
    disputeRepository = module.get(getRepositoryToken(Dispute));
    userRepository = module.get(getRepositoryToken(User));
    assetRepository = module.get(getRepositoryToken(AllowedAsset));

    ipfsService = module.get(IpfsService);
    webhookService = module.get(WebhookService);

    lifecycleService = module.get(EscrowLifecycleService);
    fundingService = module.get(EscrowFundingService);
    disputeService = module.get(EscrowDisputeService);
    queryService = module.get(EscrowQueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('dispute evidence pipeline', () => {
    const disputedEscrow = {
      ...mockEscrow,
      status: EscrowStatus.DISPUTED,
      parties: [{ ...mockParty, userId: 'seller-123' }],
    } as Escrow;

    const openDispute = {
      id: 'dispute-123',
      escrowId: 'escrow-123',
      filedByUserId: 'user-123',
      reason: 'Delivery issue',
      evidence: null,
      evidenceFiles: null,
      status: DisputeStatus.OPEN,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    } as Dispute;

    beforeEach(() => {
      escrowRepository.findOne.mockResolvedValue(disputedEscrow);
      userRepository.findOne.mockResolvedValue(null);
      eventRepository.findOne.mockResolvedValue(null);
      eventRepository.create.mockImplementation((event) => event as EscrowEvent);
      eventRepository.save.mockImplementation(
        async (event) => event as EscrowEvent,
      );
    });

    it('uploads evidence files to IPFS and appends immutable dispute metadata', async () => {
      disputeRepository.findOne.mockResolvedValue({ ...openDispute });
      disputeRepository.save.mockImplementation(
        async (dispute) => dispute as Dispute,
      );
      ipfsService.uploadFile
        .mockResolvedValueOnce('cid-1')
        .mockResolvedValueOnce('cid-2');

      const result = await service.uploadEvidence('escrow-123', 'user-123', [
        {
          buffer: Buffer.from('pdf'),
          originalname: 'invoice.pdf',
          mimetype: 'application/pdf',
          size: 3,
        },
        {
          buffer: Buffer.from('png'),
          originalname: 'photo.png',
          mimetype: 'image/png',
          size: 3,
        },
      ]);

      expect(ipfsService.uploadFile).toHaveBeenCalledTimes(2);
      expect(result.cids).toEqual(['cid-1', 'cid-2']);
      expect(disputeRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          evidence: ['cid-1', 'cid-2'],
          evidenceFiles: [
            expect.objectContaining({
              cid: 'cid-1',
              name: 'invoice.pdf',
              type: 'application/pdf',
              size: 3,
              uploadedBy: 'user-123',
            }),
            expect.objectContaining({
              cid: 'cid-2',
              name: 'photo.png',
              type: 'image/png',
              size: 3,
              uploadedBy: 'user-123',
            }),
          ],
        }),
      );
    });

    it('lists evidence metadata for dispute parties', async () => {
      disputeRepository.findOne.mockResolvedValue({
        ...openDispute,
        evidenceFiles: [
          {
            cid: 'cid-1',
            name: 'invoice.pdf',
            type: 'application/pdf',
            size: 3,
            uploadedAt: '2026-01-01T00:00:00.000Z',
            uploadedBy: 'user-123',
          },
        ],
      });

      await expect(
        service.listEvidence('escrow-123', 'seller-123'),
      ).resolves.toEqual([
        expect.objectContaining({
          cid: 'cid-1',
          name: 'invoice.pdf',
        }),
      ]);
    });

    it('streams a specific evidence file from IPFS with stored metadata', async () => {
      disputeRepository.findOne.mockResolvedValue({
        ...openDispute,
        evidenceFiles: [
          {
            cid: 'cid-1',
            name: 'invoice.pdf',
            type: 'application/pdf',
            size: 3,
            uploadedAt: '2026-01-01T00:00:00.000Z',
            uploadedBy: 'user-123',
          },
        ],
      });

      const result = await service.getEvidenceFile(
        'escrow-123',
        'seller-123',
        'cid-1',
      );

      expect(ipfsService.getFileStream).toHaveBeenCalledWith('cid-1');
      expect(result.metadata.name).toBe('invoice.pdf');
      expect(result.contentType).toBe('application/pdf');
    });

    it('allows admins to access evidence even when they are not escrow parties', async () => {
      userRepository.findOne.mockResolvedValue({
        id: 'admin-123',
        role: UserRole.ADMIN,
      } as User);
      disputeRepository.findOne.mockResolvedValue({
        ...openDispute,
        evidence: ['legacy-cid'],
      });

      await expect(
        service.listEvidence('escrow-123', 'admin-123'),
      ).resolves.toEqual([
        expect.objectContaining({
          cid: 'legacy-cid',
          name: 'legacy-cid',
          type: 'application/octet-stream',
        }),
      ]);
    });

    it('rejects evidence access for users who are neither parties nor admins', async () => {
      await expect(
        service.listEvidence('escrow-123', 'stranger-123'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  // ✅ KEEP ALL YOUR EXISTING TESTS BELOW UNCHANGED
});
