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
import { NotificationService } from '../../../notifications/notifications.service';
import { NotificationEventType } from '../../../notifications/enums/notification-event.enum';

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

  let ipfsService: { uploadFile: jest.Mock; getGatewayUrl: jest.Mock };
  let webhookService: { dispatchEvent: jest.Mock };
  let notificationService: { handleEscrowEvent: jest.Mock };

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
      findOne: jest.fn(),
      find: jest.fn(),
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

    const mockNotificationService = {
      handleEscrowEvent: jest.fn().mockResolvedValue(undefined),
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
        { provide: NotificationService, useValue: mockNotificationService },

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
    notificationService = module.get(NotificationService);

    lifecycleService = module.get(EscrowLifecycleService);
    fundingService = module.get(EscrowFundingService);
    disputeService = module.get(EscrowDisputeService);
    queryService = module.get(EscrowQueryService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('acceptPartyInvitation', () => {
    const pendingParty = {
      ...mockParty,
      status: PartyStatus.PENDING,
      respondedAt: null,
      escrow: {
        id: 'escrow-123',
        title: 'Test Escrow',
        status: EscrowStatus.PENDING,
        creatorId: 'user-123',
      },
    } as Party;

    it('sets status to ACCEPTED and records respondedAt', async () => {
      partyRepository.findOne.mockResolvedValue({
        ...pendingParty,
        status: PartyStatus.PENDING,
      });
      partyRepository.save.mockResolvedValue({
        ...pendingParty,
        status: PartyStatus.ACCEPTED,
      });
      eventRepository.create.mockReturnValue({} as any);
      eventRepository.save.mockResolvedValue({} as any);
      userRepository.findOne.mockResolvedValue({
        id: 'user-456',
        email: 'seller@test.com',
      } as User);

      const result = await service.acceptPartyInvitation(
        'escrow-123',
        'party-123',
        'user-456',
      );

      expect(result.status).toBe(PartyStatus.ACCEPTED);
      expect(partyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PartyStatus.ACCEPTED,
          respondedAt: expect.any(Date),
        }),
      );
    });

    it('notifies the escrow creator on acceptance', async () => {
      partyRepository.findOne.mockResolvedValue({
        ...pendingParty,
        status: PartyStatus.PENDING,
      });
      partyRepository.save.mockResolvedValue({
        ...pendingParty,
        status: PartyStatus.ACCEPTED,
      });
      eventRepository.create.mockReturnValue({} as any);
      eventRepository.save.mockResolvedValue({} as any);
      userRepository.findOne.mockResolvedValue({
        id: 'user-456',
        email: 'seller@test.com',
      } as User);

      await service.acceptPartyInvitation(
        'escrow-123',
        'party-123',
        'user-456',
      );

      await new Promise(process.nextTick); // flush fire-and-forget
      expect(notificationService.handleEscrowEvent).toHaveBeenCalledWith(
        'user-123',
        NotificationEventType.PARTY_ACCEPTED,
        expect.objectContaining({ escrowId: 'escrow-123' }),
      );
    });

    it('throws ForbiddenException when user is not the party', async () => {
      partyRepository.findOne.mockResolvedValue({
        ...pendingParty,
        status: PartyStatus.PENDING,
      });

      await expect(
        service.acceptPartyInvitation('escrow-123', 'party-123', 'wrong-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when invitation is already responded', async () => {
      partyRepository.findOne.mockResolvedValue({
        ...pendingParty,
        status: PartyStatus.ACCEPTED,
      });

      await expect(
        service.acceptPartyInvitation('escrow-123', 'party-123', 'user-456'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when party does not exist', async () => {
      partyRepository.findOne.mockResolvedValue(null);

      await expect(
        service.acceptPartyInvitation('escrow-123', 'nonexistent', 'user-456'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('rejectPartyInvitation', () => {
    const pendingSellerParty = {
      ...mockParty,
      status: PartyStatus.PENDING,
      respondedAt: null,
      escrow: {
        id: 'escrow-123',
        title: 'Test Escrow',
        status: EscrowStatus.PENDING,
        creatorId: 'user-123',
      },
    } as Party;

    it('sets status to REJECTED and records respondedAt', async () => {
      partyRepository.findOne.mockResolvedValue({
        ...pendingSellerParty,
        status: PartyStatus.PENDING,
      });
      partyRepository.save.mockResolvedValue({
        ...pendingSellerParty,
        status: PartyStatus.REJECTED,
      });
      eventRepository.create.mockReturnValue({} as any);
      eventRepository.save.mockResolvedValue({} as any);
      escrowRepository.update = jest.fn().mockResolvedValue({});
      userRepository.findOne.mockResolvedValue({
        id: 'user-456',
        email: 'seller@test.com',
      } as User);

      const result = await service.rejectPartyInvitation(
        'escrow-123',
        'party-123',
        'user-456',
      );

      expect(result.status).toBe(PartyStatus.REJECTED);
      expect(partyRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PartyStatus.REJECTED,
          respondedAt: expect.any(Date),
        }),
      );
    });

    it('auto-cancels the escrow when a required party rejects', async () => {
      partyRepository.findOne.mockResolvedValue({
        ...pendingSellerParty,
        status: PartyStatus.PENDING,
      });
      partyRepository.save.mockResolvedValue({
        ...pendingSellerParty,
        status: PartyStatus.REJECTED,
      });
      eventRepository.create.mockReturnValue({} as any);
      eventRepository.save.mockResolvedValue({} as any);
      const updateMock = jest.fn().mockResolvedValue({});
      escrowRepository.update = updateMock;
      webhookService.dispatchEvent = jest.fn().mockResolvedValue(undefined);
      userRepository.findOne.mockResolvedValue({
        id: 'user-456',
        email: undefined,
      } as User);

      await service.rejectPartyInvitation(
        'escrow-123',
        'party-123',
        'user-456',
      );

      expect(updateMock).toHaveBeenCalledWith(
        'escrow-123',
        expect.objectContaining({ status: EscrowStatus.CANCELLED }),
      );
    });

    it('throws ForbiddenException when user is not the party', async () => {
      partyRepository.findOne.mockResolvedValue({
        ...pendingSellerParty,
        status: PartyStatus.PENDING,
      });

      await expect(
        service.rejectPartyInvitation('escrow-123', 'party-123', 'wrong-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getPendingInvitations', () => {
    it('returns pending party invitations for user', async () => {
      const pendingParties = [
        {
          ...mockParty,
          status: PartyStatus.PENDING,
          escrow: { id: 'escrow-123' },
        },
      ];
      partyRepository.find.mockResolvedValue(pendingParties as Party[]);

      const result = await service.getPendingInvitations('user-456');

      expect(partyRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-456', status: PartyStatus.PENDING },
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no pending invitations', async () => {
      partyRepository.find.mockResolvedValue([]);

      const result = await service.getPendingInvitations('user-456');

      expect(result).toHaveLength(0);
    });
  });

  describe('fund - party acceptance gate', () => {
    it('throws BadRequestException when seller has not accepted', async () => {
      const escrowWithPendingSeller = {
        ...mockEscrow,
        status: EscrowStatus.PENDING,
        stellarTxHash: undefined,
        amount: 100,
        parties: [
          {
            role: PartyRole.BUYER,
            status: PartyStatus.ACCEPTED,
            userId: 'user-123',
          },
          {
            role: PartyRole.SELLER,
            status: PartyStatus.PENDING,
            userId: 'user-456',
          },
        ],
      };
      escrowRepository.findOne.mockResolvedValue(
        escrowWithPendingSeller as Escrow,
      );

      await expect(
        service.fund(
          'escrow-123',
          { amount: 100 } as any,
          'user-123',
          'wallet-addr',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
