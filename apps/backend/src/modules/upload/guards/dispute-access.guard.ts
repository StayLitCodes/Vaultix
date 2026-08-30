import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute } from '../../escrow/entities/dispute.entity';
import { EscrowService } from '../../escrow/services/escrow.service';

interface AuthUser {
  sub?: string;
  userId?: string;
  walletAddress: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  params: { id?: string; evidenceId?: string };
  dispute?: Dispute;
}

@Injectable()
export class DisputeAccessGuard implements CanActivate {
  constructor(
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    private readonly escrowService: EscrowService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    const disputeId = request.params.id;

    const userId = user?.sub ?? user?.userId;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!disputeId) return true;

    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }

    const hasAccess = await this.escrowService.isUserPartyToEscrow(
      dispute.escrowId,
      userId,
    );

    const isAdmin = await this.escrowService.isUserAdmin(userId);

    if (!hasAccess && !isAdmin) {
      throw new ForbiddenException('You do not have access to this dispute');
    }

    request.dispute = dispute;
    return true;
  }
}
