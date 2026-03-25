import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConsistencyCheckerService } from '../services/consistency-checker.service';
import {
  ConsistencyCheckRequest,
  ConsistencyCheckResponse,
} from '../dto/consistency-check.dto';
import { AdminGuard } from '../../auth/middleware/admin.guard';

@Controller('admin/escrows')
@UseGuards(AdminGuard)
export class AdminEscrowConsistencyController {
  constructor(private readonly checker: ConsistencyCheckerService) {}

  @Post('consistency-check')
  async checkConsistency(
    @Body() body: ConsistencyCheckRequest,
  ): Promise<ConsistencyCheckResponse> {
    return this.checker.checkConsistency(body);
  }
}
