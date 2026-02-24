import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { EscrowService } from '../services/escrow.service';
import { ListEventsDto } from '../dto/list-events.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: { sub: string; walletAddress: string };
}

@Controller('events')
@UseGuards(ThrottlerGuard, AuthGuard)
export class EventsController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get()
  async findAllEvents(
    @Query() query: ListEventsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    return this.escrowService.findEvents(userId, query);
  }
}
