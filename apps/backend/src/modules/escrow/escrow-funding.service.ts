import {
  Injectable,
  ConflictException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Escrow, EscrowStatus, EscrowType } from './entities/escrow.entity';
import { Condition } from './entities/condition.entity';
import { validateTransition } from './escrow-state-machine';

@Injectable()
export class EscrowFundingService {
  constructor(
    @InjectRepository(Escrow)
    private escrowRepo: Repository<Escrow>,
    @InjectRepository(Condition)
    private conditionRepo: Repository<Condition>,
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

  async releaseMilestone(
    escrowId: string,
    conditionId: string,
  ): Promise<Escrow> {
    const escrow = await this.escrowRepo.findOne({
      where: { id: escrowId },
      relations: ['conditions'],
    });
    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    if (escrow.type !== EscrowType.MILESTONE) {
      throw new BadRequestException(
        'Partial releases are only available for milestone escrows',
      );
    }

    if (escrow.status !== EscrowStatus.ACTIVE) {
      throw new BadRequestException(
        'Escrow must be active to release milestones',
      );
    }

    const condition = escrow.conditions.find((c) => c.id === conditionId);
    if (!condition) {
      throw new NotFoundException('Condition not found');
    }

    if (!condition.isMet) {
      throw new BadRequestException(
        'Condition must be confirmed before releasing',
      );
    }

    if (condition.isReleased) {
      throw new BadRequestException('This milestone has already been released');
    }

    if (!condition.amount) {
      throw new BadRequestException(
        'This condition does not have an amount associated with it',
      );
    }

    const newReleasedAmount =
      Number(escrow.releasedAmount || 0) + Number(condition.amount);
    if (newReleasedAmount > Number(escrow.amount)) {
      throw new BadRequestException(
        'Cannot release more than the total escrow amount',
      );
    }

    // Update condition
    condition.isReleased = true;
    condition.releasedAt = new Date();
    await this.conditionRepo.save(condition);

    // Update escrow
    escrow.releasedAmount = newReleasedAmount;
    if (newReleasedAmount >= Number(escrow.amount)) {
      escrow.status = EscrowStatus.COMPLETED;
      escrow.isReleased = true;
    }
    await this.escrowRepo.save(escrow);

    return escrow;
  }
}
