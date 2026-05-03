import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';

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

describe('EscrowService', () => {
  let service: EscrowService;
  let escrowRepository: jest.Mocked<Repository<Escrow>>;
  let partyRepository: jest.Mocked<Repository<Party>>;
  let conditionRepository: jest.Mocked<Repository<Condition>>;
  let eventRepository: jest.Mocked<Repository<EscrowEvent>>;
  let disputeRepository: jest.Mocked<Repository<Dispute>>;
  let userRepository: jest.Mocked<Repository<User>>;
  let assetRepository: jest.Mocked<Repository<AllowedAsset>>;

  let ipfsService: { uploadFile: jest.Mock; getGatewayUrl: jest.Mock };
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

  // ✅ KEEP ALL YOUR EXISTING TESTS BELOW UNCHANGED
});