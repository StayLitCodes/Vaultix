import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { EscrowSchedulerService } from '../services/escrow-scheduler.service';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('escrows/scheduler')
@UseGuards(AuthGuard, AdminGuard)
export class EscrowSchedulerController {
  constructor(private readonly schedulerService: EscrowSchedulerService) {}

  @Post('process-expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process expired escrows', description: 'Triggers the background job to process expired escrows manually.' })
  @ApiOkResponse({ description: 'Job initiated' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async processExpiredEscrows() {
    await this.schedulerService.handleExpiredEscrows();
    return { message: 'Expired escrow processing initiated' };
  }

  @Post('send-warnings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send expiration warnings', description: 'Triggers the background job to send escrow expiration warnings.' })
  @ApiOkResponse({ description: 'Warnings initiated' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async sendExpirationWarnings() {
    await this.schedulerService.sendExpirationWarnings();
    return { message: 'Expiration warning sending initiated' };
  }

  @Post('process/:escrowId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process escrow manually', description: 'Forces processing of a specific escrow by ID.' })
  @ApiOkResponse({ description: 'Escrow processed manually' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async processEscrowManually(@Param('escrowId') escrowId: string) {
    await this.schedulerService.processEscrowManually(escrowId);
    return { message: `Escrow ${escrowId} processed manually` };
  }
}
