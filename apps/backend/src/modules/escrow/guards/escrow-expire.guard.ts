import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { Escrow } from '../entities/escrow.entity';
import { EscrowService } from '../services/escrow.service';

interface AuthUser {
  sub?: string;
  userId?: string;
}

interface AuthenticatedRequest extends Request {
  user?: AuthUser;
  params: { id?: string };
  escrow?: Escrow;
}

@Injectable()
export class EscrowExpireGuard implements CanActivate {
  constructor(private readonly escrowService: EscrowService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actorId = request.user?.sub ?? request.user?.userId;
    const escrowId = request.params.id;

    if (!actorId) {
      throw new ForbiddenException('User not authenticated');
    }

    if (!escrowId) {
      return true;
    }

    const escrow = await this.escrowService.findOne(escrowId);
    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    request.escrow = escrow;

    if (await this.escrowService.isUserAdmin(actorId)) {
      return true;
    }

    const isParty = await this.escrowService.isUserPartyToEscrow(
      escrowId,
      actorId,
    );

    if (!isParty) {
      throw new ForbiddenException('You do not have access to this escrow');
    }

    return true;
  }
}
