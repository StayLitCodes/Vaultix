import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Escrow, EscrowStatus } from './entities/escrow.entity';
import { validateTransition } from './escrow-state-machine';

@Injectable()
export class EscrowFundingService {
  constructor(
    @InjectRepository(Escrow)
    private escrowRepo: Repository<Escrow>,
  ) {}

  async fund(escrow: Escrow) {
    if (escrow.status !== EscrowStatus.PENDING) {
      throw new ConflictException('Escrow not fundable');
    }

    validateTransition(escrow.status, EscrowStatus.ACTIVE);

    escrow.status = EscrowStatus.ACTIVE;
    return this.escrowRepo.save(escrow);
  }

  async release(escrow: Escrow) {
    validateTransition(escrow.status, EscrowStatus.COMPLETED);

    escrow.status = EscrowStatus.COMPLETED;
    escrow.isReleased = true;

    return this.escrowRepo.save(escrow);
  }

  async refund(escrow: Escrow) {
    validateTransition(escrow.status, EscrowStatus.CANCELLED);

    escrow.status = EscrowStatus.CANCELLED;

    return this.escrowRepo.save(escrow);
  }
}
