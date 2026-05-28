import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository, IsNull } from 'typeorm';
import { Escrow, EscrowStatus } from '../entities/escrow.entity';
import { DisputeOutcome } from '../entities/dispute.entity';
import { EscrowService } from './escrow.service';

@Injectable()
export class DisputeDefaultResolutionService {
  private readonly logger = new Logger(DisputeDefaultResolutionService.name);

  // X days deadline is set at dispute filing time; scheduler just triggers when past deadline.
  // Fallback behavior is configurable via env.
  private readonly fallbackOutcome: DisputeOutcome;

  constructor(
    @InjectRepository(Escrow)
    private readonly escrowRepository: Repository<Escrow>,
    private readonly escrowService: EscrowService,
  ) {
    const fallback = process.env.DISPUTE_DEFAULT_OUTCOME;
    // default: refund depositor
    this.fallbackOutcome =
      (fallback as DisputeOutcome) ?? DisputeOutcome.REFUNDED_TO_BUYER;
  }

  async processExpiredDisputes(): Promise<number> {
    const now = new Date();

    const candidates = await this.escrowRepository.find({
      where: {
        status: EscrowStatus.DISPUTED,
        disputeDeadline: LessThanOrEqual(now),
      },
      // Avoid huge joins; EscrowService loads what it needs.
      relations: ['parties'],
    });

    let processed = 0;
    for (const escrow of candidates) {
      try {
        const resolved = await this.escrowService.trigger_default_resolution(
          escrow.id,
          this.fallbackOutcome,
        );
        if (resolved) processed += 1;
      } catch (err) {
        this.logger.error(
          `Failed default resolution for escrow=${escrow.id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    return processed;
  }
}

