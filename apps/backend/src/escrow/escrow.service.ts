import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escrow } from './entities/escrow.entity';
import { EscrowDetailResponseDto } from './dto/escrow-detail.dto';

interface CurrentUser {
  id: string;
  roles?: string[];
}

@Injectable()
export class EscrowsService {
  constructor(
    @InjectRepository(Escrow)
    private escrowRepo: Repository<Escrow>,
  ) {}

  async getEscrowDetail(
    escrowId: string,
    currentUser: CurrentUser,
  ): Promise<EscrowDetailResponseDto> {
    const escrow = await this.escrowRepo.findOne({
      where: { id: escrowId },
      relations: ['milestones'],
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    const isParticipant =
      escrow.depositorId === currentUser.id ||
      escrow.recipientId === currentUser.id;

    const isAdmin = currentUser.roles?.includes('admin') ?? false;

    if (!isParticipant && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    const totalAmount = Number(escrow.totalAmount);
    const totalReleased = Number(escrow.totalReleased);

    const progressPercentage =
      totalAmount === 0 ? 0 : Math.round((totalReleased / totalAmount) * 100);

    const isOverdue =
      escrow.status !== 'COMPLETED' &&
      escrow.deadline &&
      new Date() > escrow.deadline;

    return {
      escrowId: escrow.id,
      status: escrow.status,
      token: escrow.token,
      totalAmount: escrow.totalAmount,
      totalReleased: escrow.totalReleased,
      deadline: escrow.deadline,

      depositor: { id: escrow.depositorId },
      recipient: { id: escrow.recipientId },

      milestones: escrow.milestones.map((m) => ({
        index: m.index,
        description: m.description,
        amount: m.amount,
        status: m.status,
        releasedAt: m.releasedAt,
      })),

      progressPercentage,
      isOverdue,

      createdAt: escrow.createdAt,
      updatedAt: escrow.updatedAt,

      lastActionType: escrow.status,
    };
  }
}
