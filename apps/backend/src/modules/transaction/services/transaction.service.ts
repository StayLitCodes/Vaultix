import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StellarEvent, StellarEventType } from '../../stellar/entities/stellar-event.entity';
import { Escrow } from '../../escrow/entities/escrow.entity';
import { ListTransactionsDto } from '../dto/list-transactions.dto';
import { PaginatedTransactionsResponseDto, TransactionResponseDto } from '../dto/transaction-response.dto';

@Injectable()
export class TransactionService {
  constructor(
    @InjectRepository(StellarEvent)
    private readonly stellarEventRepository: Repository<StellarEvent>,
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
  ) {}

  async findAll(userId: string, walletAddress: string, query: ListTransactionsDto): Promise<PaginatedTransactionsResponseDto> {
    const { page = 1, pageSize = 20, type, fromDate, toDate, minAmount, maxAmount, sortBy, sortOrder } = query;

    const qb = this.stellarEventRepository.createQueryBuilder('event')
      .leftJoin(Escrow, 'escrow', 'escrow.id = event.escrowId')
      .select([
        'event.id AS id',
        'event.timestamp AS date',
        'event.eventType AS eventType',
        'event.escrowId AS escrowId',
        'escrow.title AS escrowTitle',
        'event.amount AS amount',
        'event.assetCode AS asset',
        'event.fromAddress AS fromAddress',
        'event.toAddress AS toAddress',
        'event.txHash AS txHash',
      ])
      .where('(event.fromAddress = :walletAddress OR event.toAddress = :walletAddress)', { walletAddress });

    if (type) {
      // Map human-friendly types back to enum if necessary, or check both
      const mappedType = this.mapHumanTypeToEnum(type);
      if (mappedType) {
        qb.andWhere('event.eventType = :mappedType', { mappedType });
      } else {
        qb.andWhere('event.eventType = :type', { type });
      }
    }

    if (fromDate) {
      qb.andWhere('event.timestamp >= :fromDate', { fromDate: new Date(fromDate) });
    }

    if (toDate) {
      qb.andWhere('event.timestamp <= :toDate', { toDate: new Date(toDate) });
    }

    if (minAmount !== undefined) {
      qb.andWhere('event.amount >= :minAmount', { minAmount });
    }

    if (maxAmount !== undefined) {
      qb.andWhere('event.amount <= :maxAmount', { maxAmount });
    }

    qb.orderBy(`event.${sortBy}`, sortOrder);

    const totalItems = await qb.getCount();
    const rawData = await qb
      .offset((page - 1) * pageSize)
      .limit(pageSize)
      .getRawMany();

    const data: TransactionResponseDto[] = rawData.map(row => ({
      id: row.id,
      date: row.date,
      type: this.mapEventTypeToHuman(row.eventType),
      escrowId: row.escrowId,
      escrowTitle: row.escrowTitle,
      amount: parseFloat(row.amount || '0'),
      asset: row.asset || 'XLM',
      counterpartyAddress: row.fromAddress === walletAddress ? (row.toAddress || 'Contract') : row.fromAddress,
      txHash: row.txHash,
    }));

    return {
      data,
      totalItems,
      totalPages: Math.ceil(totalItems / pageSize),
      page,
      pageSize,
    };
  }

  private mapEventTypeToHuman(type: StellarEventType): string {
    switch (type) {
      case StellarEventType.ESCROW_FUNDED:
        return 'funding';
      case StellarEventType.MILESTONE_RELEASED:
        return 'milestone_release';
      case StellarEventType.ESCROW_COMPLETED:
        return 'completion';
      case StellarEventType.ESCROW_CANCELLED:
        return 'refund';
      case StellarEventType.DISPUTE_RESOLVED:
        return 'dispute_resolution';
      default:
        return type.toLowerCase();
    }
  }

  private mapHumanTypeToEnum(humanType: string): StellarEventType | null {
    const map: Record<string, StellarEventType> = {
      'funding': StellarEventType.ESCROW_FUNDED,
      'milestone_release': StellarEventType.MILESTONE_RELEASED,
      'completion': StellarEventType.ESCROW_COMPLETED,
      'refund': StellarEventType.ESCROW_CANCELLED,
      'dispute_resolution': StellarEventType.DISPUTE_RESOLVED,
    };
    return map[humanType.toLowerCase()] || null;
  }
}
