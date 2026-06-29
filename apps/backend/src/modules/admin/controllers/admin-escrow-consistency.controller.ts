import { Body, Controller, Post, UseGuards, HttpStatus } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConsistencyCheckerService } from '../services/consistency-checker.service';
import {
  ConsistencyCheckRequest,
  ConsistencyCheckResponse,
} from '../dto/consistency-check.dto';
import { AdminGuard } from '../../auth/middleware/admin.guard';

@Controller('admin/escrows')
@ApiTags('admin/escrows')
@ApiBearerAuth('access-token')
@UseGuards(AdminGuard)
export class AdminEscrowConsistencyController {
  constructor(private readonly checker: ConsistencyCheckerService) {}

  @Post('consistency-check')
  @ApiOperation({ summary: 'Run an escrow consistency check across the database and on-chain state' })
  @ApiBody({ description: 'Consistency check request payload', schema: { oneOf: [{ type: 'object', properties: { escrowIds: { type: 'array', items: { type: 'number' } } } }, { type: 'object', properties: { fromId: { type: 'number' }, toId: { type: 'number' } } }] } })
  @ApiResponse({ status: HttpStatus.OK, description: 'Consistency check completed' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid consistency check payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  async checkConsistency(
    @Body() body: ConsistencyCheckRequest,
  ): Promise<ConsistencyCheckResponse> {
    return this.checker.checkConsistency(body);
  }
}
