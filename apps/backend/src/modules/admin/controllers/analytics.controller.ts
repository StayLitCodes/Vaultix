import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('admin/analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Get high-level platform analytics overview' })
  async getOverview() {
    return this.analyticsService.getOverview();
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get escrow volume time-series data' })
  async getVolume(
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.analyticsService.getVolumeStats(period, from, to);
  }

  @Get('disputes')
  @ApiOperation({ summary: 'Get dispute-related metrics' })
  async getDisputes() {
    return this.analyticsService.getDisputeMetrics();
  }

  @Get('top-users')
  @ApiOperation({ summary: 'Get leaderboard of top users by volume' })
  async getTopUsers(@Query('limit') limit: string = '10') {
    return this.analyticsService.getTopUsers(parseInt(limit, 10));
  }
}
