import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, UpdateResult } from 'typeorm';
import { EscrowService } from './escrow.service';
import { Escrow, EscrowStatus, EscrowType } from '../entities/escrow.entity';
import { Party, PartyRole, PartyStatus } from '../entities/party.entity';
import { Condition, ConditionType } from '../entities/condition.entity';
import { EscrowEvent } from '../entities/escrow-event.entity';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('EscrowService', () => {
  let service: EscrowService;
  let escrowRepository: jest.Mocked<Repository<Escrow>>;
  let partyRepository: jest.Mocked<Repository<Party>>;
  let conditionRepository: jest.Mocked<Repository<Condition>>;
  let eventRepository: jest.Mocked<Repository<EscrowEvent>>;

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
    };

    const mockEventRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: getRepositoryToken(Escrow), useValue: mockEscrowRepo },
        { provide: getRepositoryToken(Party), useValue: mockPartyRepo },
        { provide: getRepositoryToken(Condition), useValue: mockConditionRepo },
        { provide: getRepositoryToken(EscrowEvent), useValue: mockEventRepo },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
    escrowRepository = module.get(getRepositoryToken(Escrow));
    partyRepository = module.get(getRepositoryToken(Party));
    conditionRepository = module.get(getRepositoryToken(Condition));
    eventRepository = module.get(getRepositoryToken(EscrowEvent));
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
      partyRepository.save.mockResolvedValue([mockParty] as Party[]);
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
      partyRepository.save.mockResolvedValue([mockParty] as Party[]);
      conditionRepository.create.mockReturnValue({} as Condition);
      conditionRepository.save.mockResolvedValue([] as Condition[]);
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
});
