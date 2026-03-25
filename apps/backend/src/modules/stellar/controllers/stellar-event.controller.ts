import {
  Controller,
  Get,
  Post,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { StellarEventListenerService } from '../services/stellar-event-listener.service';

@Controller('stellar/events')
export class StellarEventController {
  constructor(
    private readonly stellarEventListenerService: StellarEventListenerService,
  ) {}

  @Get('status')
  getSyncStatus() {
    return this.stellarEventListenerService.getSyncStatus();
  }

  @Post('sync')
  @HttpCode(HttpStatus.OK)
  async syncFromLedger(@Query('ledger') ledger?: string) {
    const startLedger = ledger ? parseInt(ledger, 10) : undefined;
    await this.stellarEventListenerService.syncFromLedger(startLedger || 0);
    return { message: `Sync started from ledger: ${startLedger || 0}` };
  }

  @Post('restart')
  @HttpCode(HttpStatus.OK)
  async restartListener() {
    await this.stellarEventListenerService.stopEventListener();
    await this.stellarEventListenerService.startEventListener();
    return { message: 'Event listener restarted' };
  }
}
