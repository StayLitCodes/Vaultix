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
import { CancelEscrowDto } from '../dto/cancel-escrow.dto';
import { validateTransition, isTerminalStatus } from '../escrow-state-machine';

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
