import { Body, Controller, Post, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ConsistencyCheckerService } from '../services/consistency-checker.service';
import {
  ConsistencyCheckRequest,
  ConsistencyCheckResponse,
} from '../dto/consistency-check.dto';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { ConsistencySeverity } from '../entities/consistency-report.entity';

@Controller('admin/consistency')
@UseGuards(AdminGuard)
export class AdminEscrowConsistencyController {
  constructor(private readonly checker: ConsistencyCheckerService) {}

  @Post('check')
  async checkConsistency(
    @Body() body: ConsistencyCheckRequest,
  ): Promise<ConsistencyCheckResponse> {
    return this.checker.checkConsistency(body);
  }

  @Get('reports')
  async getReports(
    @Query('severity') severity?: ConsistencySeverity,
    @Query('resolved') resolved?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.checker.getReports({
      severity,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Get(':escrowId')
  async getDetailedComparison(@Param('escrowId') escrowId: string) {
    return this.checker.getDetailedComparison(escrowId);
  }

  @Post('resolve')
  async resolveDiscrepancy(
    @Body() body: { escrowId: string; adminUserId: string; syncToOnchain: boolean },
  ) {
    await this.checker.resolveDiscrepancy(
      body.escrowId,
      body.adminUserId,
      body.syncToOnchain,
    );
    return { success: true, message: 'Discrepancy resolved' };
  }
}
