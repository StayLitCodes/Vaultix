import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { EscrowEvent, EscrowEventType } from '../entities/escrow-event.entity';
import { AdminAuditLogService } from '../../admin/services/admin-audit-log.service';
import { EventsGateway } from '../../../gateways/events.gateway';

@Injectable()
export class EscrowExpirySchedulerService {
  private readonly logger = new Logger(EscrowExpirySchedulerService.name);

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    @InjectRepository(EscrowEvent)
    private readonly escrowEventRepository: Repository<EscrowEvent>,
    private readonly adminAuditLogService: AdminAuditLogService,
    @Optional() private readonly eventsGateway?: EventsGateway,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleExpiredFundedEscrows() {
    this.logger.log('Starting expired funded escrow refund-request process...');

    try {
      const now = new Date();

      const expiredEscrows = await this.escrowRepository.find({
        where: {
          status: EscrowStatus.ACTIVE,
          expiresAt: LessThan(now),
          isActive: true,
        },
        relations: ['creator', 'parties', 'parties.user'],
      });

      this.logger.log(
        `Found ${expiredEscrows.length} expired funded/active escrows`,
      );

      for (const escrow of expiredEscrows) {
        try {
          await this.processRefund(escrow);
        } catch (error) {
          this.logger.error(
            `Failed to process refund for escrow ${escrow.id}:`,
            error,
          );
        }
      }

      this.logger.log('Completed expired funded escrow refund-request process');
    } catch (error) {
      this.logger.error(
        'Error during expired funded escrow refund-request process:',
        error,
      );
    }
  }

  async processRefundById(escrowId: string) {
    const escrow = await this.escrowRepository.findOne({
      where: { id: escrowId },
      relations: ['creator', 'parties', 'parties.user'],
    });

    if (!escrow) {
      throw new Error(`Escrow ${escrowId} not found`);
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new Error(`Escrow ${escrowId} is not ACTIVE`);
    }

    if (!escrow.expiresAt || escrow.expiresAt > new Date()) {
      throw new Error(`Escrow ${escrowId} has not passed its deadline`);
    }

    await this.processRefund(escrow);
  }

  async processRefund(escrow: Escrow): Promise<void> {
    if (
      escrow.status !== EscrowStatus.ACTIVE ||
      !escrow.isActive ||
      !escrow.expiresAt ||
      escrow.expiresAt > new Date()
    ) {
      return;
    }

    const existingRequest = await this.escrowEventRepository.findOne({
      where: {
        escrowId: escrow.id,
        eventType: EscrowEventType.REFUND_REQUESTED,
      },
    });
    if (existingRequest) return;

    const requestedAt = new Date();
    const event = await this.escrowEventRepository.save({
      escrowId: escrow.id,
      eventType: EscrowEventType.REFUND_REQUESTED,
      data: {
        reason: 'Deadline passed; depositor authorization is required on-chain',
        requestedAt,
        deadline: escrow.expiresAt,
      },
    });
    this.eventsGateway?.emitEscrowEvent(event);

    await this.adminAuditLogService.create({
      actorId: 'system',
      actionType: 'ESCROW_REFUND_REQUESTED',
      resourceType: 'Escrow',
      resourceId: escrow.id,
      metadata: {
        reason: 'Expired while active/funded; awaiting depositor authorization',
        deadline: escrow.expiresAt?.toISOString(),
      },
    });

    this.logger.log(
      `Marked escrow for depositor-authorized refund: ${escrow.id}`,
    );
  }
}
