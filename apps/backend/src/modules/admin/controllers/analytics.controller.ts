import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('Admin Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get high-level platform analytics overview' })
  @ApiOkResponse({ description: 'Analytics overview retrieved' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get escrow volume time-series data' })
  @ApiQuery({ name: 'period', enum: ['daily', 'weekly', 'monthly'], required: false })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiOkResponse({ description: 'Volume stats retrieved' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getVolume(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getVolumeStats(period, from, to);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'Get dispute-related metrics' })
  @ApiOkResponse({ description: 'Dispute metrics retrieved' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getDisputes() {
    return this.analyticsService.getDisputeMetrics();
  }

  @Get('top-users')
  @ApiOperation({ summary: 'Get leaderboard of top users by volume' })
  @ApiQuery({ name: 'limit', required: false, type: String })
  @ApiOkResponse({ description: 'Top users retrieved' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getTopUsers(@Query('limit') limit: string = '10') {
    return this.analyticsService.getTopUsers(parseInt(limit, 10));
  }
}
