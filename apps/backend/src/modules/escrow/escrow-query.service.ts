import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Escrow } from './entities/escrow.entity';

@Injectable()
export class EscrowQueryService {
  constructor(
    @InjectRepository(Escrow)
    private escrowRepo: Repository<Escrow>,
  ) {}

  async findOne(id: string): Promise<Escrow> {
    const escrow = await this.escrowRepo.findOne({
      where: { id },
      relations: ['parties', 'conditions'],
    });

    if (!escrow) throw new NotFoundException('Escrow not found');

    return escrow;
  }

  async findAll(userId: string) {
    return this.escrowRepo.find({
      where: [{ creatorId: userId }],
      order: { createdAt: 'DESC' },
    });
  }
}
