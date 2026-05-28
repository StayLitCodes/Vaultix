import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { EscrowService } from '../services/escrow.service';
import { ListEventsDto } from '../dto/list-events.dto';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; walletAddress: string };
}

@ApiTags('Escrows')
@ApiBearerAuth()
@Controller('events')
@UseGuards(ThrottlerGuard, AuthGuard)
export class EventsController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get()
  @ApiOperation({ summary: 'Find all events', description: 'Retrieves a paginated list of all escrow events for the authenticated user.' })
  @ApiOkResponse({ description: 'List of events retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async findAllEvents(
    @Query() query: ListEventsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return this.escrowService.findEvents(userId, query);
  }
}
