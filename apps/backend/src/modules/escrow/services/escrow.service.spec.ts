/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { EscrowService } from './escrow.service';
import { Escrow, EscrowStatus, EscrowType } from '../entities/escrow.entity';
import { Party, PartyRole, PartyStatus } from '../entities/party.entity';
import { Condition, ConditionType } from '../entities/condition.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { Dispute, DisputeStatus, DisputeOutcome } from '../entities/dispute.entity';
import { FulfillConditionDto } from '../dto/fulfill-condition.dto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { WebhookService } from '../../../services/webhook/webhook.service';
import { CreateEscrowDto } from '../dto/create-escrow.dto';

describe('EscrowService', () => {
  let service: EscrowService;
  let escrowRepository: jest.Mocked<Repository<Escrow>>;
  let partyRepository: jest.Mocked<Repository<Party>>;
  let conditionRepository: jest.Mocked<Repository<Condition>>;
  let eventRepository: jest.Mocked<Repository<EscrowEvent>>;
  let disputeRepository: jest.Mocked<Repository<Dispute>>;

  const mockEscrow: Partial<Escrow> = {
    id: 'escrow-123',
    title: 'Test Escrow',
    description: 'Test description',
    amount: 100,
    asset: 'XLM',
    status: EscrowStatus.PENDING,
    type: EscrowType.STANDARD,
    creatorId: 'user-123',
    isActive: true,
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: getRepositoryToken(Escrow), useValue: mockEscrowRepo },
        { provide: getRepositoryToken(Party), useValue: mockPartyRepo },
        { provide: getRepositoryToken(Condition), useValue: mockConditionRepo },
        { provide: getRepositoryToken(EscrowEvent), useValue: mockEventRepo },
        { provide: getRepositoryToken(Dispute), useValue: mockDisputeRepo },
        {
          provide: EscrowStellarIntegrationService,
          useValue: {
            completeOnChainEscrow: jest.fn().mockResolvedValue('mock-tx-hash'),
          },
        },
        {
          provide: WebhookService,
          useValue: {
            dispatchEvent: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    escrowRepository = module.get(getRepositoryToken(Escrow));
    partyRepository = module.get(getRepositoryToken(Party));
    conditionRepository = module.get(getRepositoryToken(Condition));
    eventRepository = module.get(getRepositoryToken(EscrowEvent));
    disputeRepository = module.get(getRepositoryToken(Dispute));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create an escrow with parties', async () => {
      const createDto: CreateEscrowDto = {
        title: 'Test Escrow',
        amount: 100,
        parties: [{ userId: 'user-456', role: PartyRole.SELLER }],
      };

      escrowRepository.create.mockReturnValue(mockEscrow as Escrow);
      escrowRepository.save.mockResolvedValue(mockEscrow as Escrow);
      escrowRepository.findOne.mockResolvedValue({
        ...mockEscrow,
        parties: [mockParty],
      } as Escrow);
      partyRepository.create.mockReturnValue(mockParty as Party);
      partyRepository.save.mockResolvedValue(mockParty as Party);
      eventRepository.create.mockReturnValue({} as EscrowEvent);
      eventRepository.save.mockResolvedValue({} as EscrowEvent);

      const result = await service.create(createDto, 'user-123');

      expect(result).toBeDefined();
      expect(escrowRepository.create.mock.calls.length).toBeGreaterThan(0);
      expect(escrowRepository.save.mock.calls.length).toBeGreaterThan(0);
      expect(partyRepository.save.mock.calls.length).toBeGreaterThan(0);
      expect(eventRepository.save.mock.calls.length).toBeGreaterThan(0);
    });

    it('should create an escrow with conditions', async () => {
      const createDto: CreateEscrowDto = {
        title: 'Test Escrow',
        amount: 100,
        parties: [{ userId: 'user-456', role: PartyRole.SELLER }],
        conditions: [
          { description: 'Delivery confirmed', type: ConditionType.MANUAL },
        ],
      };

      escrowRepository.create.mockReturnValue(mockEscrow as Escrow);
      escrowRepository.save.mockResolvedValue(mockEscrow as Escrow);
      escrowRepository.findOne.mockResolvedValue(mockEscrow as Escrow);
      partyRepository.create.mockReturnValue(mockParty as Party);
      partyRepository.save.mockResolvedValue(mockParty as Party);
      conditionRepository.create.mockReturnValue({} as Condition);
      conditionRepository.save.mockResolvedValue({} as Condition);
      eventRepository.create.mockReturnValue({} as EscrowEvent);
      eventRepository.save.mockResolvedValue({} as EscrowEvent);

      const result = await service.create(createDto, 'user-123');

      expect(result).toBeDefined();
      expect(conditionRepository.save.mock.calls.length).toBeGreaterThan(0);
    });
  });

  describe('findOne', () => {
    it('should return an escrow by id', async () => {
      escrowRepository.findOne.mockResolvedValue(mockEscrow as Escrow);

      const result = await service.findOne('escrow-123');

      expect(result).toEqual(mockEscrow);
      expect(escrowRepository.findOne.mock.calls[0]).toEqual([
        {
          where: { id: 'escrow-123' },
          relations: ['parties', 'conditions', 'events', 'creator'],
        },
      ]);
    });

    it('should throw NotFoundException if escrow not found', async () => {
      escrowRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('should update an escrow in pending status by creator', async () => {
      escrowRepository.findOne.mockResolvedValue(mockEscrow as Escrow);
      escrowRepository.update.mockResolvedValue({
        affected: 1,
      } as UpdateResult);
      eventRepository.create.mockReturnValue({} as EscrowEvent);
      eventRepository.save.mockResolvedValue({} as EscrowEvent);

      await service.update(
        'escrow-123',
        { title: 'Updated Title' },
        'user-123',
      );

      expect(escrowRepository.update.mock.calls[0]).toEqual([
        'escrow-123',
        { title: 'Updated Title' },
      ]);
    });

    it('should throw ForbiddenException if not creator', async () => {
      escrowRepository.findOne.mockResolvedValue(mockEscrow as Escrow);

      await expect(
        service.update('escrow-123', { title: 'Updated' }, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if not in pending status', async () => {
      escrowRepository.findOne.mockResolvedValue({
        ...mockEscrow,
        status: EscrowStatus.ACTIVE,
      } as Escrow);

      await expect(
        service.update('escrow-123', { title: 'Updated' }, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancel', () => {
    it('should cancel a pending escrow by creator', async () => {
      escrowRepository.findOne.mockResolvedValue(mockEscrow as Escrow);
      escrowRepository.update.mockResolvedValue({
        affected: 1,
      } as UpdateResult);
      eventRepository.create.mockReturnValue({} as EscrowEvent);
      eventRepository.save.mockResolvedValue({} as EscrowEvent);

      await service.cancel(
        'escrow-123',
        { reason: 'Changed mind' },
        'user-123',
      );

      expect(escrowRepository.update.mock.calls[0]).toEqual([
        'escrow-123',
        { status: EscrowStatus.CANCELLED },
      ]);
    });

    it('should throw BadRequestException if escrow is already completed', async () => {
      escrowRepository.findOne.mockResolvedValue({
        ...mockEscrow,
        status: EscrowStatus.COMPLETED,
      } as Escrow);

      await expect(
        service.cancel('escrow-123', {}, 'user-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException if non-creator tries to cancel pending escrow', async () => {
      escrowRepository.findOne.mockResolvedValue(mockEscrow as Escrow);

      await expect(
        service.cancel('escrow-123', {}, 'other-user'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('isUserPartyToEscrow', () => {
    it('should return true if user is creator', async () => {
      escrowRepository.findOne.mockResolvedValue(mockEscrow as Escrow);

      const result = await service.isUserPartyToEscrow(
        'escrow-123',
        'user-123',
      );

      expect(result).toBe(true);
    });

    it('should return true if user is a party', async () => {
      escrowRepository.findOne.mockResolvedValue({
        ...mockEscrow,
        creatorId: 'creator-user',
        parties: [{ userId: 'user-123' }],
      } as Escrow);

      const result = await service.isUserPartyToEscrow(
        'escrow-123',
        'user-123',
      );

      expect(result).toBe(true);
    });

    it('should return false if user is not involved', async () => {
      escrowRepository.findOne.mockResolvedValue({
        ...mockEscrow,
        creatorId: 'creator-user',
        parties: [{ userId: 'other-user' }],
      } as Escrow);

      const result = await service.isUserPartyToEscrow(
        'escrow-123',
        'user-123',
      );

      expect(result).toBe(false);
    });

    it('should return false if escrow not found', async () => {
      escrowRepository.findOne.mockResolvedValue(null);

      const result = await service.isUserPartyToEscrow(
        'non-existent',
        'user-123',
      );

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Dispute management
  // ---------------------------------------------------------------------------

  const activeEscrowWithParties = (overrides: Partial<Escrow> = {}): Escrow =>
    ({
      ...mockEscrow,
      status: EscrowStatus.ACTIVE,
      parties: [
        { userId: 'buyer-id', role: PartyRole.BUYER },
        { userId: 'seller-id', role: PartyRole.SELLER },
        { userId: 'arbitrator-id', role: PartyRole.ARBITRATOR },
      ],
      ...overrides,
    }) as Escrow;

  const mockDispute = (overrides: Partial<Dispute> = {}): Dispute =>
    ({
      id: 'dispute-1',
      escrowId: 'escrow-123',
      filedByUserId: 'buyer-id',
      reason: 'Item not delivered',
      evidence: null,
      status: DisputeStatus.OPEN,
      resolvedByUserId: null,
      resolutionNotes: null,
      sellerPercent: null,
      buyerPercent: null,
      outcome: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Dispute;

  describe('fileDispute', () => {
    beforeEach(() => {
      eventRepository.create.mockReturnValue({} as EscrowEvent);
      eventRepository.save.mockResolvedValue({} as EscrowEvent);
    });

    it('should allow a buyer to file a dispute and transition escrow to DISPUTED', async () => {
      escrowRepository.findOne.mockResolvedValue(activeEscrowWithParties());
      disputeRepository.findOne.mockResolvedValue(null);
      escrowRepository.update.mockResolvedValue({ affected: 1 } as any);
      disputeRepository.create.mockReturnValue(mockDispute() as Dispute);
      disputeRepository.save.mockResolvedValue(mockDispute() as Dispute);
      // Final findOne to return with relations
      disputeRepository.findOne
        .mockResolvedValueOnce(null) // duplicate-check returns null
        .mockResolvedValueOnce(mockDispute() as Dispute); // final fetch

      const result = await service.fileDispute(
        'escrow-123',
        'buyer-id',
        { reason: 'Item not delivered' },
      );

      expect(escrowRepository.update).toHaveBeenCalledWith('escrow-123', {
        status: EscrowStatus.DISPUTED,
      });
      expect(disputeRepository.save).toHaveBeenCalled();
      expect(result.status).toBe(DisputeStatus.OPEN);
    });

    it('should allow a seller to file a dispute', async () => {
      escrowRepository.findOne.mockResolvedValue(activeEscrowWithParties());
      disputeRepository.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockDispute({ filedByUserId: 'seller-id' }) as Dispute);
      escrowRepository.update.mockResolvedValue({ affected: 1 } as any);
      disputeRepository.create.mockReturnValue(mockDispute() as Dispute);
      disputeRepository.save.mockResolvedValue(mockDispute() as Dispute);

      const result = await service.fileDispute(
        'escrow-123',
        'seller-id',
        { reason: 'Payment not received', evidence: ['https://example.com/proof'] },
      );

      expect(result).toBeDefined();
      expect(escrowRepository.update).toHaveBeenCalledWith('escrow-123', {
        status: EscrowStatus.DISPUTED,
      });
    });

    it('should throw BadRequestException when escrow is not ACTIVE', async () => {
      escrowRepository.findOne.mockResolvedValue({
        ...mockEscrow,
        status: EscrowStatus.PENDING,
        parties: [],
      } as Escrow);

      await expect(
        service.fileDispute('escrow-123', 'buyer-id', { reason: 'Test' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ForbiddenException when an arbitrator tries to file', async () => {
      escrowRepository.findOne.mockResolvedValue(activeEscrowWithParties());

      await expect(
        service.fileDispute('escrow-123', 'arbitrator-id', { reason: 'Test' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException when a dispute already exists', async () => {
      escrowRepository.findOne.mockResolvedValue(activeEscrowWithParties());
      disputeRepository.findOne.mockResolvedValue(mockDispute() as Dispute);

      await expect(
        service.fileDispute('escrow-123', 'buyer-id', { reason: 'Duplicate' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getDispute', () => {
    it('should return the dispute for an escrow', async () => {
      disputeRepository.findOne.mockResolvedValue(mockDispute() as Dispute);

      const result = await service.getDispute('escrow-123');

      expect(disputeRepository.findOne).toHaveBeenCalledWith({
        where: { escrowId: 'escrow-123' },
        relations: ['filedBy', 'resolvedBy'],
      });
      expect(result.id).toBe('dispute-1');
    });

    it('should throw NotFoundException when no dispute exists', async () => {
      disputeRepository.findOne.mockResolvedValue(null);

      await expect(service.getDispute('escrow-123')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resolveDispute', () => {
    beforeEach(() => {
      eventRepository.create.mockReturnValue({} as EscrowEvent);
      eventRepository.save.mockResolvedValue({} as EscrowEvent);
    });

    it('should resolve a dispute with released_to_seller and set escrow to COMPLETED', async () => {
      escrowRepository.findOne.mockResolvedValue(
        activeEscrowWithParties({ status: EscrowStatus.DISPUTED }),
      );
      disputeRepository.findOne
        .mockResolvedValueOnce(mockDispute() as Dispute) // getDispute call
        .mockResolvedValueOnce(mockDispute({ // final fetch with relations
          status: DisputeStatus.RESOLVED,
          outcome: DisputeOutcome.RELEASED_TO_SELLER,
          resolvedByUserId: 'arbitrator-id',
        }) as Dispute);
      disputeRepository.save.mockResolvedValue(mockDispute() as Dispute);
      escrowRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.resolveDispute(
        'escrow-123',
        'arbitrator-id',
        { outcome: DisputeOutcome.RELEASED_TO_SELLER, resolutionNotes: 'Seller delivered' },
      );

      expect(escrowRepository.update).toHaveBeenCalledWith('escrow-123', {
        status: EscrowStatus.COMPLETED,
      });
      expect(result.outcome).toBe(DisputeOutcome.RELEASED_TO_SELLER);
    });

    it('should resolve a dispute with refunded_to_buyer and set escrow to CANCELLED', async () => {
      escrowRepository.findOne.mockResolvedValue(
        activeEscrowWithParties({ status: EscrowStatus.DISPUTED }),
      );
      disputeRepository.findOne
        .mockResolvedValueOnce(mockDispute() as Dispute)
        .mockResolvedValueOnce(mockDispute({
          status: DisputeStatus.RESOLVED,
          outcome: DisputeOutcome.REFUNDED_TO_BUYER,
        }) as Dispute);
      disputeRepository.save.mockResolvedValue(mockDispute() as Dispute);
      escrowRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.resolveDispute(
        'escrow-123',
        'arbitrator-id',
        { outcome: DisputeOutcome.REFUNDED_TO_BUYER, resolutionNotes: 'No delivery' },
      );

      expect(escrowRepository.update).toHaveBeenCalledWith('escrow-123', {
        status: EscrowStatus.CANCELLED,
      });
    });

    it('should resolve a split dispute when percentages sum to 100', async () => {
      escrowRepository.findOne.mockResolvedValue(
        activeEscrowWithParties({ status: EscrowStatus.DISPUTED }),
      );
      disputeRepository.findOne
        .mockResolvedValueOnce(mockDispute() as Dispute)
        .mockResolvedValueOnce(mockDispute({
          status: DisputeStatus.RESOLVED,
          outcome: DisputeOutcome.SPLIT,
          sellerPercent: 60,
          buyerPercent: 40,
        }) as Dispute);
      disputeRepository.save.mockResolvedValue(mockDispute() as Dispute);
      escrowRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.resolveDispute(
        'escrow-123',
        'arbitrator-id',
        { outcome: DisputeOutcome.SPLIT, resolutionNotes: 'Partial', sellerPercent: 60, buyerPercent: 40 },
      );

      expect(result.outcome).toBe(DisputeOutcome.SPLIT);
    });

    it('should throw ForbiddenException when a non-arbitrator tries to resolve', async () => {
      escrowRepository.findOne.mockResolvedValue(
        activeEscrowWithParties({ status: EscrowStatus.DISPUTED }),
      );

      await expect(
        service.resolveDispute('escrow-123', 'buyer-id', {
          outcome: DisputeOutcome.RELEASED_TO_SELLER,
          resolutionNotes: 'Buyer self-resolving',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException when escrow is not DISPUTED', async () => {
      escrowRepository.findOne.mockResolvedValue(activeEscrowWithParties());

      await expect(
        service.resolveDispute('escrow-123', 'arbitrator-id', {
          outcome: DisputeOutcome.RELEASED_TO_SELLER,
          resolutionNotes: 'Wrong state',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException when dispute is already resolved', async () => {
      escrowRepository.findOne.mockResolvedValue(
        activeEscrowWithParties({ status: EscrowStatus.DISPUTED }),
      );
      disputeRepository.findOne.mockResolvedValue(
        mockDispute({ status: DisputeStatus.RESOLVED }) as Dispute,
      );

      await expect(
        service.resolveDispute('escrow-123', 'arbitrator-id', {
          outcome: DisputeOutcome.REFUNDED_TO_BUYER,
          resolutionNotes: 'Already done',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw UnprocessableEntityException for split with missing percentages', async () => {
      escrowRepository.findOne.mockResolvedValue(
        activeEscrowWithParties({ status: EscrowStatus.DISPUTED }),
      );
      disputeRepository.findOne.mockResolvedValue(mockDispute() as Dispute);

      await expect(
        service.resolveDispute('escrow-123', 'arbitrator-id', {
          outcome: DisputeOutcome.SPLIT,
          resolutionNotes: 'Forgot percentages',
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });

    it('should throw UnprocessableEntityException when split percentages do not sum to 100', async () => {
      escrowRepository.findOne.mockResolvedValue(
        activeEscrowWithParties({ status: EscrowStatus.DISPUTED }),
      );
      disputeRepository.findOne.mockResolvedValue(mockDispute() as Dispute);

      await expect(
        service.resolveDispute('escrow-123', 'arbitrator-id', {
          outcome: DisputeOutcome.SPLIT,
          resolutionNotes: 'Bad math',
          sellerPercent: 60,
          buyerPercent: 30,
        }),
      ).rejects.toThrow(UnprocessableEntityException);
    });
  });

  describe('fulfillCondition', () => {
    const mockActiveEscrow = {
      ...mockEscrow,
      status: EscrowStatus.ACTIVE,
      parties: [
        { userId: 'seller-123', role: PartyRole.SELLER },
        { userId: 'buyer-123', role: PartyRole.BUYER },
      ],
    };

    it('should allow seller to fulfill condition', async () => {
      const fulfillDto: FulfillConditionDto = {
        notes: 'Package delivered',
        evidence: 'Tracking number: ABC123',
      };

      escrowRepository.findOne.mockResolvedValue(mockActiveEscrow as Escrow);
      conditionRepository.findOne.mockResolvedValue(mockCondition as Condition);
      conditionRepository.save.mockResolvedValue({
        ...mockCondition,
        isFulfilled: true,
        fulfilledAt: new Date(),
        fulfilledByUserId: 'seller-123',
        fulfillmentNotes: fulfillDto.notes,
        fulfillmentEvidence: fulfillDto.evidence,
      } as Condition);
      eventRepository.create.mockReturnValue({} as EscrowEvent);
      eventRepository.save.mockResolvedValue({} as EscrowEvent);

      const result = await service.fulfillCondition(
        'escrow-123',
        'condition-123',
        fulfillDto,
        'seller-123',
      );

      expect(result.isFulfilled).toBe(true);
      expect(conditionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isFulfilled: true }),
      );
      expect(eventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({}),
      );
    });

    it('should throw ForbiddenException if non-seller tries to fulfill', async () => {
      escrowRepository.findOne.mockResolvedValue(mockActiveEscrow as Escrow);

      await expect(
        service.fulfillCondition(
          'escrow-123',
          'condition-123',
          {},
          'buyer-123',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if escrow is not active', async () => {
      escrowRepository.findOne.mockResolvedValue(mockEscrow as Escrow);

      await expect(
        service.fulfillCondition(
          'escrow-123',
          'condition-123',
          {},
          'seller-123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should be idempotent if condition already fulfilled', async () => {
      const fulfilledCondition = { ...mockCondition, isFulfilled: true };
      escrowRepository.findOne.mockResolvedValue(mockActiveEscrow as Escrow);
      conditionRepository.findOne.mockResolvedValue(
        fulfilledCondition as Condition,
      );

      const result = await service.fulfillCondition(
        'escrow-123',
        'condition-123',
        {},
        'seller-123',
      );

      expect(result.isFulfilled).toBe(true);
      expect(conditionRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('confirmCondition', () => {
    const mockActiveEscrowWithMultipleConditions = {
      ...mockEscrow,
      status: EscrowStatus.ACTIVE,
      parties: [
        { userId: 'seller-123', role: PartyRole.SELLER },
        { userId: 'buyer-123', role: PartyRole.BUYER },
      ],
      conditions: [
        { ...mockCondition, isFulfilled: true, isMet: false },
        { id: 'condition-456', isFulfilled: false, isMet: false }, // Another condition not met
      ],
    };

    it('should allow buyer to confirm fulfilled condition', async () => {
      const fulfilledCondition = {
        ...mockCondition,
        isFulfilled: true,
        escrow: mockActiveEscrowWithMultipleConditions,
      };
      escrowRepository.findOne.mockResolvedValue(
        mockActiveEscrowWithMultipleConditions as Escrow,
      );
      conditionRepository.findOne.mockResolvedValue(
        fulfilledCondition as Condition,
      );
      conditionRepository.save.mockResolvedValue({
        ...fulfilledCondition,
        isMet: true,
        metAt: new Date(),
        metByUserId: 'buyer-123',
      } as Condition);
      eventRepository.create.mockReturnValue({} as EscrowEvent);
      eventRepository.save.mockResolvedValue({} as EscrowEvent);

      const result = await service.confirmCondition(
        'escrow-123',
        'condition-123',
        'buyer-123',
      );

      expect(result.isMet).toBe(true);
      expect(conditionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isMet: true }),
      );
      expect(eventRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({}),
      );
    });

    it('should throw ForbiddenException if non-buyer tries to confirm', async () => {
      escrowRepository.findOne.mockResolvedValue(
        mockActiveEscrowWithMultipleConditions as Escrow,
      );

      await expect(
        service.confirmCondition('escrow-123', 'condition-123', 'seller-123'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if condition not fulfilled', async () => {
      const unfulfilledCondition = { ...mockCondition, isFulfilled: false };
      escrowRepository.findOne.mockResolvedValue(
        mockActiveEscrowWithMultipleConditions as Escrow,
      );
      conditionRepository.findOne.mockResolvedValue(
        unfulfilledCondition as Condition,
      );

      await expect(
        service.confirmCondition('escrow-123', 'condition-123', 'buyer-123'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should be idempotent if condition already confirmed', async () => {
      const confirmedCondition = {
        ...mockCondition,
        isFulfilled: true,
        isMet: true,
      };
      escrowRepository.findOne.mockResolvedValue(
        mockActiveEscrowWithMultipleConditions as Escrow,
      );
      conditionRepository.findOne.mockResolvedValue(
        confirmedCondition as Condition,
      );

      const result = await service.confirmCondition(
        'escrow-123',
        'condition-123',
        'buyer-123',
      );

      expect(result.isMet).toBe(true);
      expect(conditionRepository.save).not.toHaveBeenCalled();
    });
  });
});
