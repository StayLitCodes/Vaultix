import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { Party, PartyRole } from '../entities/party.entity';
import { Condition } from '../entities/condition.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { UpdateEscrowDto } from '../dto/update-escrow.dto';
import { ListEscrowsDto, SortOrder } from '../dto/list-escrows.dto';
import { ListEventsDto, EventSortOrder } from '../dto/list-events.dto';
import { EventResponseDto } from '../dto/event-response.dto';
import { CancelEscrowDto } from '../dto/cancel-escrow.dto';
import { FulfillConditionDto } from '../dto/fulfill-condition.dto';
import { validateTransition, isTerminalStatus } from '../escrow-state-machine';
import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { WebhookService } from '../../../services/webhook/webhook.service';

@Injectable()
export class EscrowService {
  constructor(
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(Condition)
    private conditionRepository: Repository<Condition>,
    @InjectRepository(EscrowEvent)
    private eventRepository: Repository<EscrowEvent>,

    private readonly stellarIntegrationService: EscrowStellarIntegrationService,
    private readonly webhookService: WebhookService,
  ) {}

  async create(
    dto: CreateEscrowDto,
    creatorId: string,
    ipAddress?: string,
  ): Promise<Escrow> {
    const escrow = this.escrowRepository.create({
      title: dto.title,
      description: dto.description,
      amount: dto.amount,
      asset: dto.asset || 'XLM',
      type: dto.type,
      creatorId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    const savedEscrow = await this.escrowRepository.save(escrow);

    const parties = dto.parties.map((partyDto) =>
      this.partyRepository.create({
        escrowId: savedEscrow.id,
        userId: partyDto.userId,
        role: partyDto.role,
      }),
    );
    await this.partyRepository.save(parties);

    if (dto.conditions && dto.conditions.length > 0) {
      const conditions = dto.conditions.map((conditionDto) =>
        this.conditionRepository.create({
          escrowId: savedEscrow.id,
          description: conditionDto.description,
          type: conditionDto.type,
          metadata: conditionDto.metadata,
        }),
      );
      await this.conditionRepository.save(conditions);
    }

    await this.logEvent(
      savedEscrow.id,
      EscrowEventType.CREATED,
      creatorId,
      { dto },
      ipAddress,
    );

    // Dispatch webhook for escrow.created
    await this.webhookService.dispatchEvent('escrow.created', {
      escrowId: savedEscrow.id,
    });

    return this.findOne(savedEscrow.id);
  }

  async findAll(
    userId: string,
    query: ListEscrowsDto,
  ): Promise<{ data: Escrow[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb: SelectQueryBuilder<Escrow> = this.escrowRepository
      .createQueryBuilder('escrow')
      .leftJoinAndSelect('escrow.parties', 'party')
      .leftJoinAndSelect('escrow.conditions', 'condition')
      .where('(escrow.creatorId = :userId OR party.userId = :userId)', {
        userId,
      });

    if (query.status) {
      qb.andWhere('escrow.status = :status', { status: query.status });
    }

    if (query.type) {
      qb.andWhere('escrow.type = :type', { type: query.type });
    }

    if (query.role) {
      qb.andWhere('party.role = :role', { role: query.role });
    }

    if (query.search) {
      qb.andWhere(
        '(escrow.title LIKE :search OR escrow.description LIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    const sortOrder = query.sortOrder === SortOrder.ASC ? 'ASC' : 'DESC';
    qb.orderBy(`escrow.${query.sortBy || 'createdAt'}`, sortOrder);

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { id },
      relations: ['parties', 'conditions', 'events', 'creator'],
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    return escrow;
  }

  async update(
    id: string,
    dto: UpdateEscrowDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Escrow> {
    const escrow = await this.findOne(id);

    if (escrow.creatorId !== userId) {
      throw new ForbiddenException('Only the creator can update this escrow');
    }

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new BadRequestException(
        'Escrow can only be updated while in pending status',
      );
    }

    const updateData: Partial<Escrow> = {};
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.expiresAt !== undefined)
      updateData.expiresAt = new Date(dto.expiresAt);

    await this.escrowRepository.update(id, updateData);

    await this.logEvent(
      id,
      EscrowEventType.UPDATED,
      userId,
      { changes: dto },
      ipAddress,
    );
    // Optionally dispatch webhook for escrow update

    return this.findOne(id);
  }

  async cancel(
    id: string,
    dto: CancelEscrowDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Escrow> {
    const escrow = await this.findOne(id);

    if (isTerminalStatus(escrow.status)) {
      throw new BadRequestException(
        `Cannot cancel an escrow that is already ${escrow.status}`,
      );
    }

    if (escrow.status === EscrowStatus.PENDING) {
      if (escrow.creatorId !== userId) {
        throw new ForbiddenException(
          'Only the creator can cancel a pending escrow',
        );
      }
    } else if (escrow.status === EscrowStatus.ACTIVE) {
      const arbitrator = escrow.parties?.find(
        (p) => p.role === PartyRole.ARBITRATOR && p.userId === userId,
      );
      if (!arbitrator && escrow.creatorId !== userId) {
        throw new ForbiddenException(
          'Only the creator or arbitrator can cancel an active escrow',
        );
      }
    }

    validateTransition(escrow.status, EscrowStatus.CANCELLED);

    await this.escrowRepository.update(id, { status: EscrowStatus.CANCELLED });

    await this.logEvent(
      id,
      EscrowEventType.CANCELLED,
      userId,
      { reason: dto.reason, previousStatus: escrow.status },
      ipAddress,
    );
    await this.webhookService.dispatchEvent('escrow.cancelled', {
      escrowId: id,
    });

    return this.findOne(id);
  }

  async isUserPartyToEscrow(
    escrowId: string,
    userId: string,
  ): Promise<boolean> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['parties'],
    });

    if (!escrow) {
      return false;
    }

    if (escrow.creatorId === userId) {
      return true;
    }

    return escrow.parties?.some((party) => party.userId === userId) ?? false;
  }

  async releaseEscrow(
    escrowId: string,
    currentUserId: string,
    manual = false,
  ): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['conditions', 'milestones'],
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    // Idempotency protection
    if (escrow.status === EscrowStatus.COMPLETED || escrow.isReleased) {
      return escrow; // Safe no-op
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException('Escrow not active');
    }

    // Manual release must be buyer
    if (manual && escrow.creatorId !== currentUserId) {
      throw new ForbiddenException('Only buyer can release escrow');
    }

    // Auto release validation
    if (!manual) {
      const allConditionsConfirmed = escrow.conditions.every(
        (c) => c.isMet === true,
      );

      if (!allConditionsConfirmed) {
        throw new BadRequestException(
          'All conditions must be confirmed for auto-release',
        );
      }
    }

    // 🔹 Execute on-chain transfer
    const txHash = await this.stellarIntegrationService.completeOnChainEscrow(
      escrow.id,
      escrow.creatorId,
    );

    escrow.status = EscrowStatus.COMPLETED;
    escrow.isReleased = true;
    escrow.releaseTransactionHash = txHash;

    await this.escrowRepository.save(escrow);

    await this.logEvent(escrow.id, EscrowEventType.COMPLETED, currentUserId, {
      txHash,
    });
    await this.webhookService.dispatchEvent('escrow.released', {
      escrowId: escrow.id,
      txHash,
    });

    return escrow;
  }

  async fulfillCondition(
    escrowId: string,
    conditionId: string,
    dto: FulfillConditionDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Condition> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['parties', 'conditions'],
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(
        'Escrow must be active to fulfill conditions',
      );
    }

    // Check if user is a seller
    const sellerParty = escrow.parties?.find(
      (p) => p.role === PartyRole.SELLER && p.userId === userId,
    );

    if (!sellerParty) {
      throw new ForbiddenException('Only sellers can fulfill conditions');
    }

    const condition = await this.conditionRepository.findOne({
      where: { id: conditionId, escrowId },
      relations: ['escrow'],
    });

    if (!condition) {
      throw new NotFoundException('Condition not found');
    }

    if (condition.isFulfilled) {
      return condition; // idempotent
    }

    // Mark condition as fulfilled by seller
    condition.isFulfilled = true;
    condition.fulfilledAt = new Date();
    condition.fulfilledByUserId = userId;
    condition.fulfillmentNotes = dto.notes;
    condition.fulfillmentEvidence = dto.evidence;

    await this.conditionRepository.save(condition);

    await this.logEvent(
      escrowId,
      EscrowEventType.CONDITION_FULFILLED,
      userId,
      {
        conditionId,
        notes: dto.notes,
        evidence: dto.evidence,
      },
      ipAddress,
    );

    // Dispatch webhook for condition fulfillment
    await this.webhookService.dispatchEvent('condition.fulfilled', {
      escrowId,
      conditionId,
      fulfilledBy: userId,
    });

    return condition;
  }

  async confirmCondition(
    escrowId: string,
    conditionId: string,
    userId: string,
    ipAddress?: string,
  ): Promise<Condition> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['parties', 'conditions'],
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(
        'Escrow must be active to confirm conditions',
      );
    }

    // Check if user is a buyer
    const buyerParty = escrow.parties?.find(
      (p) => p.role === PartyRole.BUYER && p.userId === userId,
    );

    if (!buyerParty) {
      throw new ForbiddenException('Only buyers can confirm conditions');
    }

    const condition = await this.conditionRepository.findOne({
      where: { id: conditionId, escrowId },
      relations: ['escrow', 'escrow.conditions'],
    });

    if (!condition) {
      throw new NotFoundException('Condition not found');
    }

    if (!condition.isFulfilled) {
      throw new BadRequestException(
        'Condition must be fulfilled before it can be confirmed',
      );
    }

    if (condition.isMet) {
      return condition; // idempotent
    }

    // Mark condition as confirmed by buyer
    condition.isMet = true;
    condition.metAt = new Date();
    condition.metByUserId = userId;

    await this.conditionRepository.save(condition);

    await this.logEvent(
      escrowId,
      EscrowEventType.CONDITION_MET,
      userId,
      {
        conditionId,
        confirmedBy: userId,
      },
      ipAddress,
    );

    // Check if all conditions are now met for auto-release
    const allConditionsMet = escrow.conditions.every((c) =>
      c.id === condition.id ? true : c.isMet,
    );

    if (allConditionsMet) {
      await this.releaseEscrow(
        escrow.id,
        escrow.creatorId,
        false, // auto release
      );
    }

    // Dispatch webhook for condition confirmation
    await this.webhookService.dispatchEvent('condition.confirmed', {
      escrowId,
      conditionId,
      confirmedBy: userId,
      allConditionsMet,
    });

    return condition;
  }

  async findEvents(
    userId: string,
    query: ListEventsDto,
    escrowId?: string,
  ): Promise<{
    data: EventResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const qb: SelectQueryBuilder<EscrowEvent> = this.eventRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.escrow', 'escrow')
      .leftJoinAndSelect('escrow.parties', 'party')
      .leftJoinAndSelect('escrow.creator', 'creator')
      .where('(escrow.creatorId = :userId OR party.userId = :userId)', {
        userId,
      });

    // Apply escrowId filter if provided (either from parameter or query)
    const effectiveEscrowId = escrowId || query.escrowId;
    if (effectiveEscrowId) {
      qb.andWhere('event.escrowId = :escrowId', {
        escrowId: effectiveEscrowId,
      });
    }

    if (query.eventType) {
      qb.andWhere('event.eventType = :eventType', {
        eventType: query.eventType,
      });
    }

    if (query.actorId) {
      qb.andWhere('event.actorId = :actorId', { actorId: query.actorId });
    }

    if (query.dateFrom) {
      qb.andWhere('event.createdAt >= :dateFrom', {
        dateFrom: new Date(query.dateFrom),
      });
    }

    if (query.dateTo) {
      qb.andWhere('event.createdAt <= :dateTo', {
        dateTo: new Date(query.dateTo),
      });
    }

    const sortOrder = query.sortOrder === EventSortOrder.ASC ? 'ASC' : 'DESC';
    qb.orderBy(`event.${query.sortBy || 'createdAt'}`, sortOrder);

    const [events, total] = await qb.skip(skip).take(limit).getManyAndCount();

    // Transform to response DTO
    const data: EventResponseDto[] = events.map((event) => ({
      id: event.id,
      escrowId: event.escrowId,
      eventType: event.eventType,
      actorId: event.actorId,
      data: event.data,
      ipAddress: event.ipAddress,
      createdAt: event.createdAt,
      escrow: event.escrow
        ? {
            id: event.escrow.id,
            title: event.escrow.title,
            amount: event.escrow.amount,
            asset: event.escrow.asset,
            status: event.escrow.status,
          }
        : undefined,
      actor: event.actorId
        ? {
            walletAddress: event.actorId, // In real implementation, this would come from user lookup
          }
        : undefined,
    }));

    return { data, total, page, limit };
  }

  private async logEvent(
    escrowId: string,
    eventType: EscrowEventType,
    actorId: string,
    data?: Record<string, any>,
    ipAddress?: string,
  ): Promise<EscrowEvent> {
    const event = this.eventRepository.create({
      escrowId,
      eventType,
      actorId,
      data,
      ipAddress,
    });

    return this.eventRepository.save(event);
  }
}
