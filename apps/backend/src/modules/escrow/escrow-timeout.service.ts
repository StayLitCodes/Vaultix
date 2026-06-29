import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Dispute,
  DisputeOutcome,
  DisputeStatus,
} from './entities/dispute.entity';

@Injectable()
export class EscrowTimeoutService {
  private readonly logger = new Logger(EscrowTimeoutService.name);

  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
  ) {}

  /**
   * Auto-resolves disputes that have been OPEN longer than `timeoutHours`.
   * Defaults the outcome to REFUNDED_TO_BUYER when no admin action is taken.
   */
  async resolveExpiredDisputes(timeoutHours = 72): Promise<number> {
    const cutoff = new Date(Date.now() - timeoutHours * 60 * 60 * 1000);
    const openDisputes = await this.disputeRepo.find({
      where: { status: DisputeStatus.OPEN },
    });

    const expired = openDisputes.filter((d) => d.createdAt < cutoff);

    for (const dispute of expired) {
      dispute.status = DisputeStatus.RESOLVED;
      dispute.outcome = DisputeOutcome.REFUNDED_TO_BUYER;
      dispute.resolvedAt = new Date();
      dispute.resolutionNotes = `Auto-resolved: no admin action within ${timeoutHours}h`;
      await this.disputeRepo.save(dispute);
      this.logger.log(
        `Dispute ${dispute.id} auto-resolved after ${timeoutHours}h timeout`,
      );
    }

    return expired.length;
  }
}
