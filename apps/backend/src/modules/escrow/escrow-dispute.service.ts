import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Dispute, DisputeStatus } from './entities/dispute.entity';
import { Escrow, EscrowStatus } from './entities/escrow.entity';
import { validateTransition } from './escrow-state-machine';
import { DisputeOutcome } from './entities/dispute.entity';

@Injectable()
export class EscrowDisputeService {
  constructor(
    @InjectRepository(Dispute)
    private disputeRepo: Repository<Dispute>,
    @InjectRepository(Escrow)
    private escrowRepo: Repository<Escrow>,
  ) {}

  async fileDispute(escrow: Escrow, userId: string, reason: string) {
    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new ConflictException('Cannot dispute this escrow');
    }

    validateTransition(escrow.status, EscrowStatus.DISPUTED);

    escrow.status = EscrowStatus.DISPUTED;
    await this.escrowRepo.save(escrow);

    return this.disputeRepo.save({
      escrowId: escrow.id,
      initiatorUserId: userId,
      reason,
      status: DisputeStatus.OPEN,
    });
  }

  async resolve(dispute: Dispute, outcome: DisputeOutcome) {
    dispute.status = DisputeStatus.RESOLVED;
    dispute.outcome = outcome;

    return this.disputeRepo.save(dispute);
  }
}
