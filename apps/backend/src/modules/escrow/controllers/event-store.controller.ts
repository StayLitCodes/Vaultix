import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { EscrowAccessGuard } from '../guards/escrow-access.guard';
import { EscrowEventStoreService } from '../services/escrow-event-store.service';
import {
  AppendEventDto,
  EventStoreQueryDto,
  TimelineResponseDto,
} from '../dto/event-store.dto';
import { AdminGuard } from '../../auth/middleware/admin.guard';

interface AuthenticatedRequest extends ExpressRequest {
  user: { sub?: string; userId?: string; walletAddress: string; role?: string };
}

@ApiTags('event-store')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard, AuthGuard)
@Controller()
export class EventStoreController {
  constructor(
    private readonly eventStoreService: EscrowEventStoreService,
  ) {}

  @Get('escrows/:id/events')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({
    summary: 'Get paginated events for an escrow with filtering by type',
  })
  async findEscrowEvents(
    @Param('id') id: string,
    @Query() query: EventStoreQueryDto,
  ) {
    return this.eventStoreService.query(query, id);
  }

  @Get('events')
  @ApiOperation({
    summary:
      'Global event stream with filtering by actor, type, date range',
  })
  async findAllEvents(
    @Query() query: EventStoreQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.eventStoreService.query(query);
  }

  @Get('escrows/:id/timeline')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({
    summary:
      'Human-readable timeline reconstruction from events',
  })
  async getTimeline(
    @Param('id') id: string,
  ): Promise<TimelineResponseDto> {
    return this.eventStoreService.getTimeline(id);
  }

  @Post('admin/escrows/:id/replay-events')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiOperation({
    summary:
      'Reconstruct escrow state from event log and compare with current DB state',
  })
  async replayEvents(
    @Param('id') id: string,
  ) {
    return this.eventStoreService.replayAndCheck(id);
  }
}
