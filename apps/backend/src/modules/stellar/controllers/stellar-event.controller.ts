import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StellarEventListenerService } from '../services/stellar-event-listener.service';
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('Stellar Events')
@Controller('stellar/events')
export class StellarEventController {
  constructor(
    private readonly stellarEventListenerService: StellarEventListenerService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Get listener sync status', description: 'Retrieves the current sync status of the Stellar event listener.' })
  @ApiOkResponse({ description: 'Sync status retrieved' })
  getSyncStatus() {
    return this.stellarEventListenerService.getSyncStatus();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sync from specific ledger', description: 'Forces the event listener to start syncing from a specified ledger number.' })
  @ApiQuery({ name: 'ledger', required: false, description: 'Ledger sequence number' })
  @ApiOkResponse({ description: 'Sync started' })
  async syncFromLedger(@Query('ledger') ledger?: string) {
    const startLedger = ledger ? parseInt(ledger, 10) : undefined;
    await this.stellarEventListenerService.syncFromLedger(startLedger || 0);
    return { message: `Sync started from ledger: ${startLedger || 0}` };
  }

  @Post('restart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Restart event listener', description: 'Stops and restarts the Stellar event listener.' })
  @ApiOkResponse({ description: 'Listener restarted' })
  async restartListener() {
    await this.stellarEventListenerService.stopEventListener();
    await this.stellarEventListenerService.startEventListener();
    return { message: 'Event listener restarted' };
  }
}
