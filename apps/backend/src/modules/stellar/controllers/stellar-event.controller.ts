import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { StellarEventListenerService } from '../services/stellar-event-listener.service';

@Controller('stellar/events')
@ApiTags('stellar/events')
export class StellarEventController {
  constructor(
    private readonly stellarEventListenerService: StellarEventListenerService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get the current Stellar event sync status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sync status retrieved successfully' })
  getSyncStatus() {
    return this.stellarEventListenerService.getSyncStatus();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger a Stellar ledger sync' })
  @ApiQuery({ name: 'ledger', required: false, description: 'Starting ledger number' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Sync started successfully' })
  async syncFromLedger(@Query('ledger') ledger?: string) {
    const startLedger = ledger ? parseInt(ledger, 10) : undefined;
    await this.stellarEventListenerService.syncFromLedger(startLedger || 0);
    return { message: `Sync started from ledger: ${startLedger || 0}` };
  }

  @Post('restart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restart the Stellar event listener' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Listener restarted successfully' })
  async restartListener() {
    await this.stellarEventListenerService.stopEventListener();
    await this.stellarEventListenerService.startEventListener();
    return { message: 'Event listener restarted' };
  }
}
