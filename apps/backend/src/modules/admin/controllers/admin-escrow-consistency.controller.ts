import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ConsistencyCheckerService } from '../services/consistency-checker.service';
import {
  ConsistencyCheckRequest,
  ConsistencyCheckResponse,
} from '../dto/consistency-check.dto';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiBody,
} from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin/escrows')
@UseGuards(AdminGuard)
export class AdminEscrowConsistencyController {
  constructor(private readonly checker: ConsistencyCheckerService) {}

  @Post('consistency-check')
  @ApiOperation({
    summary: 'Check escrow consistency',
    description: 'Compares off-chain DB records with on-chain data to ensure consistency.',
  })
  @ApiBody({ type: ConsistencyCheckRequest })
  @ApiOkResponse({
    description: 'Consistency check completed',
    type: ConsistencyCheckResponse,
  })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async checkConsistency(
    @Body() body: ConsistencyCheckRequest,
  ): Promise<ConsistencyCheckResponse> {
    return this.checker.checkConsistency(body);
  }
}
