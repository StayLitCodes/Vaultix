import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Escrow, EscrowStatus } from './entities/escrow.entity';
import { Party } from './entities/party.entity';
import { Condition } from './entities/condition.entity';
import { EscrowEvent, EscrowEventType } from './entities/escrow-event.entity';
import { CreateEscrowDto } from './dto/create-escrow.dto';
import { validateTransition } from './escrow-state-machine';

@Injectable()
export class EscrowLifecycleService {
  constructor(
    @InjectRepository(Escrow)
    private escrowRepo: Repository<Escrow>,
    @InjectRepository(Party)
    private partyRepo: Repository<Party>,
    @InjectRepository(Condition)
    private conditionRepo: Repository<Condition>,
    @InjectRepository(EscrowEvent)
    private eventRepo: Repository<EscrowEvent>,
  ) {}

  async create(dto: CreateEscrowDto, creatorId: string): Promise<Escrow> {
    const escrow = this.escrowRepo.create({
      ...dto,
      creatorId,
      status: EscrowStatus.PENDING,
    });

    const saved = await this.escrowRepo.save(escrow);

    await this.partyRepo.save(
      dto.parties.map((p) =>
        this.partyRepo.create({ ...p, escrowId: saved.id }),
      ),
    );

    if (dto.conditions) {
      await this.conditionRepo.save(
        dto.conditions.map((c) =>
          this.conditionRepo.create({ ...c, escrowId: saved.id }),
        ),
      );
    }

    await this.logEvent(saved.id, EscrowEventType.CREATED, creatorId);

    return saved;
  }

  async cancel(escrow: Escrow, userId: string): Promise<Escrow> {
    validateTransition(escrow.status, EscrowStatus.CANCELLED);

    escrow.status = EscrowStatus.CANCELLED;
    const saved = await this.escrowRepo.save(escrow);

    await this.logEvent(saved.id, EscrowEventType.CANCELLED, userId);

    return saved;
  }

  async expire(escrow: Escrow): Promise<Escrow> {
    validateTransition(escrow.status, EscrowStatus.EXPIRED);

    escrow.status = EscrowStatus.EXPIRED;
    const saved = await this.escrowRepo.save(escrow);

    await this.logEvent(saved.id, EscrowEventType.EXPIRED);

    return saved;
  }

  private async logEvent(
    escrowId: string,
    type: EscrowEventType,
    actorId?: string,
  ): Promise<void> {
    const event = this.eventRepo.create({
      escrow: { id: escrowId },
      eventType: type,
      actorId,
    });

    await this.eventRepo.save(event);
  }
}
