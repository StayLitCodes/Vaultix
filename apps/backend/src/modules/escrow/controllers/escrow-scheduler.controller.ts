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

@Controller('escrows/scheduler')
@UseGuards(AuthGuard, AdminGuard)
export class EscrowSchedulerController {
  constructor(private readonly schedulerService: EscrowSchedulerService) {}

  @Post('process-expired')
  @HttpCode(HttpStatus.OK)
  async processExpiredEscrows() {
    await this.schedulerService.handleExpiredEscrows();
    return { message: 'Expired escrow processing initiated' };
  }

  @Post('send-warnings')
  @HttpCode(HttpStatus.OK)
  async sendExpirationWarnings() {
    await this.schedulerService.sendExpirationWarnings();
    return { message: 'Expiration warning sending initiated' };
  }

  @Post('process/:escrowId')
  @HttpCode(HttpStatus.OK)
  async processEscrowManually(@Param('escrowId') escrowId: string) {
    await this.schedulerService.processEscrowManually(escrowId);
    return { message: `Escrow ${escrowId} processed manually` };
  }
}
