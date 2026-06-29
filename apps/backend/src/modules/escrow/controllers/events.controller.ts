import { Controller, Get, Query, UseGuards, Request, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { EscrowService } from '../services/escrow.service';
import { ListEventsDto } from '../dto/list-events.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: { userId: string; walletAddress: string };
}

@Controller('events')
@ApiTags('events')
@ApiBearerAuth('access-token')
@UseGuards(ThrottlerGuard, AuthGuard)
export class EventsController {
  constructor(private readonly escrowService: EscrowService) {}

  @Get()
  @ApiOperation({ summary: 'List escrow-related events for the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Events retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async findAllEvents(
    @Query() query: ListEventsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.userId;
    return this.escrowService.findEvents(userId, query);
  }
}
