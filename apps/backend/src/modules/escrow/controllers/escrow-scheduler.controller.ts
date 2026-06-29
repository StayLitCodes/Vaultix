import {
  Controller,
  Post,
  Param,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { EscrowSchedulerService } from '../services/escrow-scheduler.service';

@Controller('escrows/scheduler')
@ApiTags('escrows/scheduler')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, AdminGuard)
export class EscrowSchedulerController {
  constructor(private readonly schedulerService: EscrowSchedulerService) {}

  @Post('process-expired')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process expired escrows' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Expired escrows processing initiated' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  async processExpiredEscrows() {
    await this.schedulerService.handleExpiredEscrows();
    return { message: 'Expired escrow processing initiated' };
  }

  @Post('send-warnings')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send expiration warnings for escrows approaching their deadline' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Expiration warnings queued successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  async sendExpirationWarnings() {
    await this.schedulerService.sendExpirationWarnings();
    return { message: 'Expiration warning sending initiated' };
  }

  @Post('process/:escrowId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process a specific escrow manually' })
  @ApiParam({ name: 'escrowId', description: 'Escrow ID to process' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Escrow processing initiated' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Escrow not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  async processEscrowManually(@Param('escrowId') escrowId: string) {
    await this.schedulerService.processEscrowManually(escrowId);
    return { message: `Escrow ${escrowId} processed manually` };
  }
}
