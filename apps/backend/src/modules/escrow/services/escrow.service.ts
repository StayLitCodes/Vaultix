import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { Party, PartyRole } from '../entities/party.entity';
import { Condition } from '../entities/condition.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { UpdateEscrowDto } from '../dto/update-escrow.dto';
import { ListEscrowsDto, SortOrder } from '../dto/list-escrows.dto';
import { CancelEscrowDto } from '../dto/cancel-escrow.dto';
import {
  EscrowOverviewQueryDto,
  EscrowOverviewResponseDto,
  EscrowOverviewRole,
  EscrowOverviewSortBy,
  EscrowOverviewSortOrder,
  EscrowOverviewStatus,
} from '../dto/escrow-overview.dto';
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

  async findOverview(
    userId: string,
    query: EscrowOverviewQueryDto,
  ): Promise<EscrowOverviewResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const role = query.role ?? EscrowOverviewRole.ANY;
    const sortBy = query.sortBy ?? EscrowOverviewSortBy.CREATED_AT;
    const sortOrder =
      query.sortOrder === EscrowOverviewSortOrder.ASC ? 'ASC' : 'DESC';

    const qb = this.escrowRepository.createQueryBuilder('escrow');

    qb.select([
      'escrow.id AS escrowId',
      'escrow.creatorId AS depositor',
      'escrow.asset AS token',
      'escrow.amount AS totalAmount',
      'escrow.status AS status',
      'escrow.expiresAt AS deadline',
      'escrow.createdAt AS createdAt',
      'escrow.updatedAt AS updatedAt',
    ])
      .addSelect(
        `CASE WHEN escrow.isReleased = 1 OR escrow.status = :completedStatus THEN escrow.amount ELSE 0 END`,
        'totalReleased',
      )
      .addSelect(
        `CASE WHEN escrow.isReleased = 1 OR escrow.status = :completedStatus THEN 0 ELSE escrow.amount END`,
        'remainingAmount',
      )
      .addSelect(
        (recipientSubquery) =>
          recipientSubquery
            .select('recipientParty.userId')
            .from(Party, 'recipientParty')
            .where('recipientParty.escrowId = escrow.id')
            .andWhere('recipientParty.role = :recipientRole')
            .limit(1),
        'recipient',
      )
      .setParameter('completedStatus', EscrowStatus.COMPLETED)
      .setParameter('recipientRole', PartyRole.SELLER);

    const recipientExistsSubquery = qb
      .subQuery()
      .select('1')
      .from(Party, 'partyFilter')
      .where('partyFilter.escrowId = escrow.id')
      .andWhere('partyFilter.userId = :userId')
      .andWhere('partyFilter.role = :recipientRole')
      .getQuery();

    if (role === EscrowOverviewRole.DEPOSITOR) {
      qb.where('escrow.creatorId = :userId', { userId });
    } else if (role === EscrowOverviewRole.RECIPIENT) {
      qb.where(`EXISTS (${recipientExistsSubquery})`, { userId });
    } else {
      qb.where(
        new Brackets((overviewScope) => {
          overviewScope
            .where('escrow.creatorId = :userId', { userId })
            .orWhere(`EXISTS (${recipientExistsSubquery})`, { userId });
        }),
      );
    }

    if (query.status) {
      if (query.status === EscrowOverviewStatus.EXPIRED) {
        qb.andWhere('escrow.expiresAt IS NOT NULL')
          .andWhere('escrow.expiresAt < :now', { now: new Date() })
          .andWhere('escrow.status IN (:...expirableStatuses)', {
            expirableStatuses: [EscrowStatus.PENDING, EscrowStatus.ACTIVE],
          });
      } else if (query.status === EscrowOverviewStatus.CREATED) {
        qb.andWhere('escrow.status = :status', {
          status: EscrowStatus.PENDING,
        });
      } else {
        qb.andWhere('escrow.status = :status', { status: query.status });
      }
    }

    if (query.token) {
      qb.andWhere('escrow.asset = :asset', { asset: query.token });
    }

    if (query.from) {
      qb.andWhere('escrow.createdAt >= :fromDate', {
        fromDate: new Date(query.from),
      });
    }

    if (query.to) {
      qb.andWhere('escrow.createdAt <= :toDate', {
        toDate: new Date(query.to),
      });
    }

    if (sortBy === EscrowOverviewSortBy.DEADLINE) {
      qb.orderBy('escrow.expiresAt', sortOrder);
    } else {
      qb.orderBy('escrow.createdAt', sortOrder);
    }

    const totalItems = await qb.getCount();
    const rows = await qb
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany<{
        escrowId: string;
        depositor: string;
        recipient: string | null;
        token: string;
        totalAmount: string | number;
        totalReleased: string | number;
        remainingAmount: string | number;
        status: string;
        deadline: Date | null;
        createdAt: Date;
        updatedAt: Date;
      }>();

    return {
      data: rows.map((row) => ({
        escrowId: row.escrowId,
        depositor: row.depositor,
        recipient: row.recipient,
        token: row.token,
        totalAmount: Number(row.totalAmount),
        totalReleased: Number(row.totalReleased),
        remainingAmount: Number(row.remainingAmount),
        status: row.status,
        deadline: row.deadline,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      totalItems,
      totalPages: totalItems > 0 ? Math.ceil(totalItems / pageSize) : 0,
      page,
      pageSize,
    };
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

  async confirmCondition(
    conditionId: string,
    userId: string,
  ): Promise<Condition> {
    const condition = await this.conditionRepository.findOne({
      where: { id: conditionId },
      relations: ['escrow', 'escrow.conditions'],
    });

    if (!condition) {
      throw new NotFoundException('Condition not found');
    }

    if (condition.isMet) {
      return condition; // idempotent
    }

    // Mark condition as met
    condition.isMet = true;
    condition.metAt = new Date();
    condition.metByUserId = userId;

    await this.conditionRepository.save(condition);

    const escrow = condition.escrow;

    // 🔥 AUTO RELEASE CHECK
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

    return condition;
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
