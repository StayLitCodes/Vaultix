import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  UnprocessableEntityException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { Party, PartyRole } from '../entities/party.entity';
import { Condition } from '../entities/condition.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import {
  Dispute,
  DisputeStatus,
  DisputeOutcome,
} from '../entities/dispute.entity';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { UpdateEscrowDto } from '../dto/update-escrow.dto';
import { ListEscrowsDto, SortOrder } from '../dto/list-escrows.dto';
import { ListEventsDto, EventSortOrder } from '../dto/list-events.dto';
import { EventResponseDto } from '../dto/event-response.dto';
import { CancelEscrowDto } from '../dto/cancel-escrow.dto';
import {
  EscrowOverviewQueryDto,
  EscrowOverviewResponseDto,
  EscrowOverviewRole,
  EscrowOverviewSortBy,
  EscrowOverviewSortOrder,
  EscrowOverviewStatus,
} from '../dto/escrow-overview.dto';
import { FulfillConditionDto } from '../dto/fulfill-condition.dto';
import { FileDisputeDto, ResolveDisputeDto } from '../dto/dispute.dto';
import { FundEscrowDto } from '../dto/fund-escrow.dto';
import { ExpireEscrowDto } from '../dto/expire-escrow.dto';
import { ProposeMilestoneChangeDto } from '../dto/milestone-change.dto';
import { validateTransition, isTerminalStatus } from '../escrow-state-machine';
import { EscrowStellarIntegrationService } from './escrow-stellar-integration.service';
import { WebhookService } from '../../../services/webhook/webhook.service';
import { User, UserRole } from '../../user/entities/user.entity';
import { IpfsService } from '../../ipfs/ipfs.service';
import { AllowedAsset } from '../../assets/entities/allowed-asset.entity';
import { normalizeMetadataHash } from '../utils/metadata-hash.util';
import { EscrowLifecycleService } from '../escrow-lifecycle.service';
import { EscrowFundingService } from '../escrow-funding.service';
import { EscrowDisputeService } from '../escrow-dispute.service';
import { EscrowQueryService } from '../escrow-query.service';
import { StellarService } from '../../../services/stellar.service';

@Injectable()
export class EscrowService {
  private readonly logger = new Logger(EscrowService.name);

  constructor(
    @InjectRepository(Escrow)
    private escrowRepository: Repository<Escrow>,
    @InjectRepository(Party)
    private partyRepository: Repository<Party>,
    @InjectRepository(Condition)
    private conditionRepository: Repository<Condition>,
    @InjectRepository(EscrowEvent)
    private eventRepository: Repository<EscrowEvent>,
    @InjectRepository(Dispute)
    private disputeRepository: Repository<Dispute>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(AllowedAsset)
    private assetRepository: Repository<AllowedAsset>,

    private readonly stellarIntegrationService: EscrowStellarIntegrationService,
    private readonly webhookService: WebhookService,
    private readonly ipfsService: IpfsService,
    private readonly lifecycle: EscrowLifecycleService,
    private readonly funding: EscrowFundingService,
    private readonly dispute: EscrowDisputeService,
    private readonly query: EscrowQueryService,
    private readonly stellarService: StellarService,
  ) {}

  async create(
    dto: CreateEscrowDto,
    creatorId: string,
    ipAddress?: string,
  ): Promise<Escrow> {
    // Validate Asset code and issuer
    const assetCode = dto.asset?.code || 'XLM';
    const assetIssuer = dto.asset?.issuer || null;

    const allowedAsset = await this.assetRepository.findOne({
      where: {
        code: assetCode,
        issuer: assetIssuer || undefined,
        active: true,
      },
    });

    if (!allowedAsset) {
      throw new BadRequestException(
        `Asset ${assetCode} is not allowed or inactive`,
      );
    }

    // Validate decimal precision of the amount
    const amountStr = dto.amount.toString();
    const parts = amountStr.split('.');
    if (parts.length > 1 && parts[1].length > allowedAsset.decimals) {
      throw new BadRequestException(
        `Amount exceeds asset's decimal precision of ${allowedAsset.decimals} decimal places`,
      );
    }

    // Verify creator has registered wallet address and sufficient balance
    const creatorUser = await this.userRepository.findOne({
      where: { id: creatorId },
    });
    if (!creatorUser || !creatorUser.walletAddress) {
      throw new BadRequestException('Creator has no registered wallet address');
    }

    try {
      const creatorAccount = await this.stellarService.getAccount(
        creatorUser.walletAddress,
      );
      const creatorBalance = creatorAccount.balances.find((b) => {
        if (assetCode === 'XLM' || assetCode === 'native') {
          return b.asset_type === 'native';
        } else {
          return b.asset_code === assetCode && b.asset_issuer === assetIssuer;
        }
      });

      if (!creatorBalance) {
        if (assetCode === 'XLM') {
          throw new BadRequestException(
            'Creator account has no XLM balance or does not exist',
          );
        } else {
          throw new BadRequestException(
            `Creator does not have a trustline for the asset ${assetCode}. Please establish a trustline first.`,
          );
        }
      }

      if (parseFloat(creatorBalance.balance) < dto.amount) {
        throw new BadRequestException(
          `Insufficient balance. Creator has ${creatorBalance.balance} ${assetCode}, needs ${dto.amount}`,
        );
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Failed to verify creator balance: ${error instanceof Error ? error.message : 'account may not exist'}`,
      );
    }

    // Verify destination account (recipient/seller) has a trustline for the custom token
    if (assetCode !== 'XLM') {
      const sellerParty = dto.parties.find((p) => p.role === PartyRole.SELLER);
      if (!sellerParty) {
        throw new BadRequestException(
          'Seller party is required to verify trustline',
        );
      }

      const sellerUser = await this.userRepository.findOne({
        where: { id: sellerParty.userId },
      });
      if (!sellerUser || !sellerUser.walletAddress) {
        throw new BadRequestException(
          'Seller has no registered wallet address',
        );
      }

      try {
        const sellerAccount = await this.stellarService.getAccount(
          sellerUser.walletAddress,
        );
        const sellerBalance = sellerAccount.balances.find(
          (b) => b.asset_code === assetCode && b.asset_issuer === assetIssuer,
        );

        if (!sellerBalance) {
          throw new BadRequestException(
            `Destination account ${sellerUser.walletAddress} does not trust the asset ${assetCode}. Please ask the seller to add a trustline for this asset first.`,
          );
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(
          `Destination account ${sellerUser.walletAddress} is not funded or does not trust the asset ${assetCode}.`,
        );
      }
    }

    let metadataHash: string | undefined;
    if (dto.metadataHash) {
      try {
        metadataHash = normalizeMetadataHash(dto.metadataHash);
      } catch (error) {
        throw new BadRequestException(
          `Invalid metadataHash: ${this.getErrorMessage(error)}`,
        );
      }
    }

    const escrow = this.escrowRepository.create({
      title: dto.title,
      description: dto.description,
      amount: dto.amount,
      assetCode: dto.asset?.code || 'XLM',
      assetIssuer: dto.asset?.issuer || undefined,
      type: dto.type,
      creatorId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      metadataHash,
    } as Partial<Escrow>);

    const savedEscrow = (await this.escrowRepository.save(
      escrow,
    )) as unknown as Escrow;

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
      'escrow.assetCode AS token',
      'escrow.assetIssuer AS tokenIssuer',
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
      .leftJoin(
        AllowedAsset,
        'assetInfo',
        'assetInfo.code = escrow.assetCode AND (assetInfo.issuer = escrow.assetIssuer OR (assetInfo.issuer IS NULL AND escrow.assetIssuer IS NULL))',
      )
      .addSelect('COALESCE(assetInfo.decimals, 7)', 'tokenDecimals')
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
      qb.where(`EXISTS ${recipientExistsSubquery}`, { userId });
    } else {
      qb.where(
        new Brackets((overviewScope) => {
          overviewScope
            .where('escrow.creatorId = :userId', { userId })
            .orWhere(`EXISTS ${recipientExistsSubquery}`, { userId });
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
      qb.andWhere('escrow.assetCode = :asset', { asset: query.token });
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
        tokenIssuer: string | null;
        tokenDecimals: number;
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
        tokenIssuer: row.tokenIssuer || undefined,
        tokenDecimals: row.tokenDecimals,
        totalAmount: parseFloat(row.totalAmount.toString()),
        totalReleased: parseFloat(row.totalReleased.toString()),
        remainingAmount: parseFloat(row.remainingAmount.toString()),
        status: row.status,
        deadline: row.deadline,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
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

    if (query.assetCode) {
      qb.andWhere('escrow.assetCode = :assetCode', {
        assetCode: query.assetCode,
      });
    }

    if (query.assetIssuer) {
      qb.andWhere('escrow.assetIssuer = :assetIssuer', {
        assetIssuer: query.assetIssuer,
      });
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

  async expire(
    id: string,
    dto: ExpireEscrowDto,
    userId: string,
    ipAddress?: string,
  ): Promise<Escrow> {
    const escrow = await this.findOne(id);

    const isAdmin = await this.isUserAdmin(userId);
    if (escrow.creatorId !== userId && !isAdmin) {
      throw new ForbiddenException(
        'Only the creator or an admin can expire this escrow',
      );
    }

    return this.expireEscrow(escrow, {
      actorId: userId,
      ipAddress,
      reason: dto.reason ?? 'Manually expired',
      webhookReason: dto.reason ?? null,
    });
  }

  async expireBySystem(id: string, reason: string): Promise<Escrow> {
    const escrow = await this.findOne(id);
    return this.expireEscrow(escrow, {
      reason,
      webhookReason: reason,
    });
  }

  async fund(
    id: string,
    dto: FundEscrowDto,
    userId: string,
    walletAddress: string,
    ipAddress?: string,
  ): Promise<Escrow> {
    const escrow = await this.findOne(id);

    if (escrow.creatorId !== userId) {
      throw new ForbiddenException('Only the buyer can fund this escrow');
    }

    if (escrow.status !== EscrowStatus.PENDING) {
      throw new BadRequestException(
        'Escrow can only be funded while in pending status',
      );
    }

    if (escrow.stellarTxHash) {
      throw new BadRequestException('Escrow is already funded');
    }

    const escrowAmount = Number(escrow.amount);
    if (Number(dto.amount) !== escrowAmount) {
      throw new BadRequestException('Amount must match the escrow amount');
    }

    validateTransition(escrow.status, EscrowStatus.ACTIVE);

    const stellarTxHash =
      await this.stellarIntegrationService.fundOnChainEscrow(
        id,
        walletAddress,
        String(dto.amount),
        escrow.assetCode ?? 'XLM',
        escrow.assetIssuer ?? undefined,
      );

    const fundedAt = new Date();
    await this.escrowRepository.update(id, {
      stellarTxHash,
      fundedAt,
      status: EscrowStatus.ACTIVE,
    });

    await this.logEvent(
      id,
      EscrowEventType.FUNDED,
      userId,
      { stellarTxHash },
      ipAddress,
    );
    await this.webhookService.dispatchEvent('escrow.funded', {
      escrowId: id,
      stellarTxHash,
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

    // Prevent operations on expired escrows
    if (escrow.expiresAt && escrow.expiresAt < new Date()) {
      throw new BadRequestException(
        'Cannot release an expired escrow. Use expire endpoint instead.',
      );
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

    // Prevent operations on expired escrows
    if (escrow.expiresAt && escrow.expiresAt < new Date()) {
      throw new BadRequestException(
        'Cannot fulfill conditions on an expired escrow',
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

    // Prevent operations on expired escrows
    if (escrow.expiresAt && escrow.expiresAt < new Date()) {
      throw new BadRequestException(
        'Cannot confirm conditions on an expired escrow',
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
            assetCode: event.escrow.assetCode,
            assetIssuer: event.escrow.assetIssuer,
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

  async fileDispute(
    escrowId: string,
    userId: string,
    dto: FileDisputeDto,
    ipAddress?: string,
  ): Promise<Dispute> {
    const escrow = await this.findOne(escrowId);

    const existing = await this.disputeRepository.findOne({
      where: { escrowId },
    });
    if (existing) {
      throw new ConflictException(
        'A dispute has already been filed for this escrow',
      );
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(
        'Disputes can only be filed against active escrows',
      );
    }

    const isBuyer = escrow.creatorId === userId;
    const filingParty = escrow.parties?.find(
      (p) => p.userId === userId && p.role !== PartyRole.ARBITRATOR,
    );
    if (!isBuyer && !filingParty) {
      throw new ForbiddenException(
        'Only a buyer or seller party can file a dispute',
      );
    }

    // Set dispute resolution deadline (backend-enforced)
    // Default: 7 days from dispute filing time.
    // Default: 7 days from dispute filing time.
    // NOTE: We keep this deterministic and backend-only for the DB-driven scheduler.
    const defaultDisputeDeadlineDays = 7;

    const disputeDeadline = new Date();
    disputeDeadline.setDate(
      disputeDeadline.getDate() + defaultDisputeDeadlineDays,
    );


    validateTransition(escrow.status, EscrowStatus.DISPUTED);
    await this.escrowRepository.update(escrowId, {
      status: EscrowStatus.DISPUTED,
<<<<<<< HEAD
      disputeDeadline,
=======
      disputeDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
>>>>>>> 589aa69adea7ff0b1b7706d1c0e19a7ffa6ba997
    });


    const dispute = this.disputeRepository.create({
      escrowId,
      filedByUserId: userId,
      reason: dto.reason,
      evidence: dto.evidence ?? null,
      status: DisputeStatus.OPEN,
    });
    const savedDispute = await this.disputeRepository.save(dispute);

    await this.logEvent(
      escrowId,
      EscrowEventType.DISPUTE_FILED,
      userId,
      { disputeId: savedDispute.id, reason: dto.reason },
      ipAddress,
    );

    await this.webhookService.dispatchEvent('escrow.disputed', {
      escrowId,
      disputeId: savedDispute.id,
    });

    return this.disputeRepository.findOne({
      where: { id: savedDispute.id },
      relations: ['filedBy'],
    }) as Promise<Dispute>;
  }

  async getDispute(escrowId: string): Promise<Dispute> {
    // Caller access is already enforced by EscrowAccessGuard at the controller layer
    const dispute = await this.disputeRepository.findOne({
      where: { escrowId },
      relations: ['filedBy', 'resolvedBy'],
    });

    if (!dispute) {
      throw new NotFoundException('No dispute found for this escrow');
    }

    return dispute;
  }

  async trigger_default_resolution(
    escrowId: string,
    fallback: DisputeOutcome,
    ipAddress?: string,
  ): Promise<Dispute | null> {
    // Apply default outcome if dispute not resolved by disputeDeadline.
    const escrow = await this.findOne(escrowId);
    if (escrow.status !== EscrowStatus.DISPUTED) {
      return null;
    }

    if (!escrow.disputeDeadline || escrow.disputeDeadline > new Date()) {
      return null;
    }

    const dispute = await this.getDispute(escrowId);
    if (dispute.status === DisputeStatus.RESOLVED) {
      return null;
    }

    // Fallback only supports refund-to-buyer or split(50/50)
    if (fallback !== DisputeOutcome.REFUNDED_TO_BUYER && fallback !== DisputeOutcome.SPLIT) {
      throw new BadRequestException('Unsupported default dispute outcome');
    }

    if (fallback === DisputeOutcome.REFUNDED_TO_BUYER) {
      const arbitratorUserId = escrow.parties?.find(
        (p) => p.role === PartyRole.ARBITRATOR,
      )?.userId;

      // We allow default resolution to proceed even if arbitratorUserId is not present in DB,
      // but the on-chain resolve requires an arbitrator authorization.
      if (!arbitratorUserId) {
        throw new BadRequestException('No arbitrator assigned for default resolution');
      }

      const dto: ResolveDisputeDto = {
        outcome: DisputeOutcome.REFUNDED_TO_BUYER,
        sellerPercent: null as any,
        buyerPercent: null as any,
        resolutionNotes: 'Default resolution (refund depositor)',
      };

      return this.resolveDispute(escrowId, arbitratorUserId, dto, ipAddress);
    }

    // SPLIT 50/50
    const arbitratorUserId = escrow.parties?.find(
      (p) => p.role === PartyRole.ARBITRATOR,
    )?.userId;
    if (!arbitratorUserId) {
      throw new BadRequestException('No arbitrator assigned for default resolution');
    }

    const dto: ResolveDisputeDto = {
      outcome: DisputeOutcome.SPLIT,
      sellerPercent: 50,
      buyerPercent: 50,
      resolutionNotes: 'Default resolution (split 50/50)',
    };

    return this.resolveDispute(escrowId, arbitratorUserId, dto, ipAddress);
  }

  async resolveDispute(
    escrowId: string,
    arbitratorUserId: string,
    dto: ResolveDisputeDto,
    ipAddress?: string,
  ): Promise<Dispute> {

    const escrow = await this.findOne(escrowId);

    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new BadRequestException('This escrow is not currently disputed');
    }

    // Caller must be an arbitrator party on this escrow
    const isArbitrator = escrow.parties?.some(
      (p) => p.userId === arbitratorUserId && p.role === PartyRole.ARBITRATOR,
    );
    if (!isArbitrator) {
      throw new ForbiddenException(
        'Only an assigned arbitrator can resolve a dispute',
      );
    }

    const dispute = await this.getDispute(escrowId);

    if (dispute.status === DisputeStatus.RESOLVED) {
      throw new ConflictException('This dispute has already been resolved');
    }

    // For a split outcome both percentages are required and must sum to 100
    if (dto.outcome === DisputeOutcome.SPLIT) {
      if (dto.sellerPercent === undefined || dto.buyerPercent === undefined) {
        throw new UnprocessableEntityException(
          'sellerPercent and buyerPercent are required for a split outcome',
        );
      }
      if (dto.sellerPercent + dto.buyerPercent !== 100) {
        throw new UnprocessableEntityException(
          'sellerPercent and buyerPercent must sum to 100',
        );
      }
    }

    // Determine the new escrow status based on the resolution outcome
    const nextEscrowStatus =
      dto.outcome === DisputeOutcome.REFUNDED_TO_BUYER
        ? EscrowStatus.CANCELLED
        : EscrowStatus.COMPLETED;

    validateTransition(escrow.status, nextEscrowStatus);

    // Resolve dispute on-chain if relevant
    let stellarTxHash: string | undefined;
    try {
      const arbitratorParty = escrow.parties.find(
        (p) => p.role === PartyRole.ARBITRATOR && p.userId === arbitratorUserId,
      );
      const buyerParty = escrow.parties.find((p) => p.role === PartyRole.BUYER);
      const sellerParty = escrow.parties.find(
        (p) => p.role === PartyRole.SELLER,
      );

      if (arbitratorParty && buyerParty && sellerParty) {
        const arbitratorUser = await this.userRepository.findOne({
          where: { id: arbitratorUserId },
        });
        const buyerUser = await this.userRepository.findOne({
          where: { id: buyerParty.userId },
        });
        const sellerUser = await this.userRepository.findOne({
          where: { id: sellerParty.userId },
        });

        if (
          arbitratorUser?.walletAddress &&
          buyerUser?.walletAddress &&
          sellerUser?.walletAddress
        ) {
          let winnerPublicKey = sellerUser.walletAddress; // Default to seller
          let splitWinnerAmount: string | undefined;

          if (dto.outcome === DisputeOutcome.REFUNDED_TO_BUYER) {
            winnerPublicKey = buyerUser.walletAddress;
          } else if (
            dto.outcome === DisputeOutcome.SPLIT &&
            dto.sellerPercent !== undefined
          ) {
            winnerPublicKey = sellerUser.walletAddress;
            const totalAmount = Number(escrow.amount);
            const asset = await this.assetRepository.findOne({
              where: {
                code: escrow.assetCode,
                issuer: escrow.assetIssuer || undefined,
              },
            });
            const decimals = asset?.decimals ?? 7;
            const sellerShare = (totalAmount * dto.sellerPercent) / 100;
            splitWinnerAmount = Math.floor(
              sellerShare * Math.pow(10, decimals),
            ).toString();
          }

          stellarTxHash =
            await this.stellarIntegrationService.resolveOnChainDispute(
              escrowId,
              winnerPublicKey,
              arbitratorUser.walletAddress,
              splitWinnerAmount,
            );
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to resolve dispute on-chain: ${error instanceof Error ? error.message : error}`,
      );
      throw new BadRequestException(
        `On-chain dispute resolution failed: ${error instanceof Error ? error.message : error}`,
      );
    }

    await this.escrowRepository.update(escrowId, {
      status: nextEscrowStatus,
      ...(stellarTxHash ? { stellarTxHash } : {}),
    });

    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolvedByUserId = arbitratorUserId;
    dispute.resolutionNotes = dto.resolutionNotes;
    dispute.outcome = dto.outcome;
    dispute.sellerPercent = dto.sellerPercent ?? null;
    dispute.buyerPercent = dto.buyerPercent ?? null;
    dispute.resolvedAt = new Date();

    const resolved = await this.disputeRepository.save(dispute);

    await this.logEvent(
      escrowId,
      EscrowEventType.DISPUTE_RESOLVED,
      arbitratorUserId,
      {
        disputeId: resolved.id,
        outcome: dto.outcome,
        sellerPercent: dto.sellerPercent,
        buyerPercent: dto.buyerPercent,
        nextEscrowStatus,
      },
      ipAddress,
    );

    await this.webhookService.dispatchEvent('escrow.resolved', {
      escrowId,
      disputeId: resolved.id,
      outcome: dto.outcome,
    });

    return this.disputeRepository.findOne({
      where: { id: resolved.id },
      relations: ['filedBy', 'resolvedBy'],
    }) as Promise<Dispute>;
  }

<<<<<<< HEAD
  async proposeMilestoneChange(
    escrowId: string,
    conditionId: string,
    dto: ProposeMilestoneChangeDto,
    userId: string,
  ): Promise<Condition> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['conditions', 'parties'],
    });

    if (!escrow) throw new NotFoundException('Escrow not found');

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(
        'Milestones can only be changed when the escrow is ACTIVE',
      );
    }

    const isBuyer =
      escrow.creatorId === userId ||
      escrow.parties.some(
        (p) => p.userId === userId && p.role === PartyRole.BUYER,
      );
    const isSeller = escrow.parties.some(
      (p) => p.userId === userId && p.role === PartyRole.SELLER,
    );
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException(
        'Only the buyer or seller can propose milestone changes',
      );
    }

    const condition = escrow.conditions.find((c) => c.id === conditionId);
    if (!condition) throw new NotFoundException('Condition not found');

    if (condition.isFulfilled || condition.isMet) {
      throw new BadRequestException(
        'Cannot change a milestone that is already fulfilled or met',
      );
    }

    if (dto.amount === undefined && dto.description === undefined) {
      throw new BadRequestException(
        'Must propose at least one change (amount or description)',
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    condition.proposedAmount = (dto.amount ?? null) as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    condition.proposedDescription = (dto.description ?? null) as any;
    condition.proposedByUserId = userId;

    await this.conditionRepository.save(condition);
    return condition;
  }

  async acceptMilestoneChange(
    escrowId: string,
    conditionId: string,
    userId: string,
  ): Promise<Condition> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['conditions', 'parties'],
    });

    if (!escrow) throw new NotFoundException('Escrow not found');

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(
        'Milestones can only be changed when the escrow is ACTIVE',
      );
    }

    const isBuyer =
      escrow.creatorId === userId ||
      escrow.parties.some(
        (p) => p.userId === userId && p.role === PartyRole.BUYER,
      );
    const isSeller = escrow.parties.some(
      (p) => p.userId === userId && p.role === PartyRole.SELLER,
    );
    if (!isBuyer && !isSeller) {
      throw new ForbiddenException(
        'Only the buyer or seller can accept milestone changes',
      );
    }

    const condition = escrow.conditions.find((c) => c.id === conditionId);
    if (!condition) throw new NotFoundException('Condition not found');

    if (!condition.proposedByUserId) {
      throw new BadRequestException('No pending proposal for this milestone');
    }

    if (condition.proposedByUserId === userId) {
      throw new ForbiddenException(
        'You cannot accept your own proposed changes',
      );
    }

    if (
      condition.proposedAmount !== null &&
      condition.proposedAmount !== undefined
    ) {
      condition.amount = condition.proposedAmount;
    }
    if (condition.proposedDescription) {
      condition.description = condition.proposedDescription;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    condition.proposedAmount = null as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    condition.proposedDescription = null as any;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    condition.proposedByUserId = null as any;

    await this.conditionRepository.save(condition);
    return condition;
=======
  async triggerDefaultResolution(escrowId: string): Promise<Escrow> {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['parties', 'creator', 'dispute'] // Assume relation added or load separately
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new BadRequestException('Escrow must be in disputed status');
    }

    const dispute = await this.disputeRepository.findOne({
      where: { escrowId },
    });

    if (!dispute || dispute.status !== DisputeStatus.OPEN) {
      throw new BadRequestException('No open dispute found');
    }

    if (!escrow.disputeDeadline || escrow.disputeDeadline > new Date()) {
      throw new BadRequestException('Dispute deadline not exceeded');
    }

    // Auto-resolve with 50/50 split
    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolutionNotes = 'Auto-resolved due to arbitrator deadline timeout (7 days exceeded). Funds split 50/50.';
    dispute.outcome = DisputeOutcome.SPLIT;
    dispute.sellerPercent = 50;
    dispute.buyerPercent = 50;
    dispute.resolvedByUserId = 'system';
    dispute.resolvedAt = new Date();
    await this.disputeRepository.save(dispute);

    // Update escrow to completed
    escrow.status = EscrowStatus.COMPLETED;
    await this.escrowRepository.save(escrow);

    // TODO: Call onchain resolve_dispute with split (requires Stellar service update)

    await this.logEvent(
      escrowId,
      EscrowEventType.DISPUTE_TIMEOUT,
      'system',
      { outcome: 'split_50_50' },
    );

    await this.webhookService.dispatchEvent('dispute.auto_resolved', {
      escrowId,
      outcome: 'split_50_50',
    });

    return this.findOne(escrowId);
>>>>>>> 589aa69adea7ff0b1b7706d1c0e19a7ffa6ba997
  }

  private async logEvent(
    escrowId: string,
    eventType: EscrowEventType,
    actorId?: string,
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

  async isUserAdmin(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    return user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;
  }

  private async expireEscrow(
    escrow: Escrow,
    options: {
      actorId?: string;
      ipAddress?: string;
      reason: string;
      webhookReason: string | null;
    },
  ): Promise<Escrow> {
    if (isTerminalStatus(escrow.status)) {
      throw new BadRequestException(
        `Cannot expire an escrow that is already ${escrow.status}`,
      );
    }

    if (
      escrow.status !== EscrowStatus.PENDING &&
      escrow.status !== EscrowStatus.ACTIVE
    ) {
      throw new BadRequestException(
        'Escrow can only be expired while in pending or active status',
      );
    }

    validateTransition(escrow.status, EscrowStatus.EXPIRED);

    await this.escrowRepository.update(escrow.id, {
      status: EscrowStatus.EXPIRED,
      isActive: false,
    });

    await this.logEvent(
      escrow.id,
      EscrowEventType.EXPIRED,
      options.actorId,
      {
        reason: options.reason,
        previousStatus: escrow.status,
      },
      options.ipAddress,
    );

    await this.webhookService.dispatchEvent('escrow.expired', {
      escrowId: escrow.id,
      reason: options.webhookReason,
    });

    return this.findOne(escrow.id);
  }

  async uploadEvidence(
    escrowId: string,
    userId: string,
    file: { buffer: Buffer; originalname: string },
  ): Promise<{ cid: string; url: string }> {
    const escrow = await this.findOne(escrowId);

    if (escrow.status !== EscrowStatus.DISPUTED) {
      throw new BadRequestException('Escrow is not in disputed status');
    }

    const dispute = await this.disputeRepository.findOne({
      where: { escrowId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute record not found');
    }

    // Upload to IPFS
    const cid = await this.ipfsService.uploadFile(
      file.buffer,
      file.originalname,
    );

    // Update dispute evidence list
    const evidence = dispute.evidence || [];
    evidence.push(cid);
    dispute.evidence = evidence;

    await this.disputeRepository.save(dispute);

    return {
      cid,
      url: this.ipfsService.getGatewayUrl(cid),
    };
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'object' && error !== null && 'message' in error) {
      const message = (error as { message?: unknown }).message;
      return typeof message === 'string' ? message : String(message);
    }

    return 'Unknown error';
  }
}
