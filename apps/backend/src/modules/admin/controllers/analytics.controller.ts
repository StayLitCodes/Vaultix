import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { AnalyticsService } from '../services/analytics.service';

@ApiTags('admin/analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @ApiOperation({
    summary: 'Get full analytics summary (volume, activity, performance, users, disputes)',
  })
  async getSummary(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return this.analyticsService.getSummary();
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get escrow volume time-series data' })
  @ApiQuery({ name: 'period', required: false, enum: ['daily', 'weekly', 'monthly'] })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  async getVolume(
    @Res({ passthrough: true }) res: Response,
    @Query('period') period: 'daily' | 'weekly' | 'monthly' = 'daily',
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    res.setHeader('Cache-Control', 'public, max-age=900');
    const [series, timeSeries] = await Promise.all([
      this.analyticsService.getVolumeStats(period, from, to),
      this.analyticsService.getVolumeTimeSeries(from, to),
    ]);
    return { series, charts: timeSeries };
  }

  @Get('users')
  @ApiOperation({ summary: 'Get user metrics and weekly active user time-series' })
  async getUsers(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    const [metrics, timeSeries] = await Promise.all([
      this.analyticsService.getUserMetrics(),
      this.analyticsService.getUserTimeSeries(),
    ]);
    return { metrics, charts: timeSeries };
  }

  @Get('disputes')
  @ApiOperation({ summary: 'Get dispute metrics including resolution and win rates' })
  async getDisputes(@Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return this.analyticsService.getDisputeMetrics();
  }

  @Get('top-users')
  @ApiOperation({ summary: 'Get leaderboard of top users by volume' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getTopUsers(
    @Res({ passthrough: true }) res: Response,
    @Query('limit') limit: string = '10',
  ) {
    res.setHeader('Cache-Control', 'public, max-age=300');
    return this.analyticsService.getTopUsers(parseInt(limit, 10));
  }
}
