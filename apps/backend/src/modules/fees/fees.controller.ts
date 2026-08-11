import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import {
  calculateTieredFeeBps,
  calculateNetAmount,
  formatFeeDisplay,
} from '../../utils/fee.util';

@ApiTags('fees')
@Controller('fees')
export class FeesController {
  @Get('tier')
  @ApiOperation({ summary: 'Get applicable fee tier for an amount' })
  @ApiQuery({
    name: 'amount',
    type: Number,
    description: 'Amount in stroops (10,000,000 stroops = 1 XLM)',
    required: true,
  })
  getFeeTier(@Query('amount') amount: string): {
    amount: number;
    feeBps: number;
    feePercentage: string;
  } {
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      throw new Error('Invalid amount');
    }

    const feeBps = calculateTieredFeeBps(amountNum);

    return {
      amount: amountNum,
      feeBps,
      feePercentage: `${(feeBps / 100).toFixed(2)}%`,
    };
  }

  @Get('calculate')
  @ApiOperation({ summary: 'Calculate fee for an amount' })
  @ApiQuery({
    name: 'amount',
    type: Number,
    description: 'Amount in stroops (10,000,000 stroops = 1 XLM)',
    required: true,
  })
  calculateFeeAmount(@Query('amount') amount: string): {
    amount: number;
    fee: number;
    netAmount: number;
    feeBps: number;
    feePercentage: string;
  } {
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum < 0) {
      throw new Error('Invalid amount');
    }

    const { fee, netAmount, feeBps } = calculateNetAmount(amountNum);

    return {
      amount: amountNum,
      fee,
      netAmount,
      feeBps,
      feePercentage: `${(feeBps / 100).toFixed(2)}%`,
    };
  }

  @Get('formatted')
  @ApiOperation({ summary: 'Get formatted fee display information' })
  @ApiQuery({
    name: 'amount',
    type: Number,
    description: 'Amount in stroops (10,000,000 stroops = 1 XLM)',
    required: true,
  })
  @ApiQuery({
    name: 'decimals',
    type: Number,
    description: 'Decimal places for formatting (default: 7)',
    required: false,
  })
  @ApiQuery({
    name: 'symbol',
    type: String,
    description: 'Asset symbol (default: XLM)',
    required: false,
  })
  getFormattedFeeDisplay(
    @Query('amount') amount: string,
    @Query('decimals') decimals: string = '7',
    @Query('symbol') symbol: string = 'XLM',
  ): {
    amount: string;
    fee: string;
    net: string;
    percentage: string;
  } {
    const amountNum = Number(amount);
    const decimalsNum = Number(decimals) || 7;

    if (isNaN(amountNum) || amountNum < 0) {
      throw new Error('Invalid amount');
    }

    return formatFeeDisplay(amountNum, decimalsNum, symbol);
  }

  @Get('tiers')
  @ApiOperation({ summary: 'Get all configured fee tiers' })
  getTiers(): Array<{
    cap: number;
    bps: number;
    percentage: string;
    range: string;
  }> {
    return [
      {
        cap: 1000,
        bps: 50,
        percentage: '0.50%',
        range: '0 - 1,000 XLM',
      },
      {
        cap: 5000,
        bps: 30,
        percentage: '0.30%',
        range: '1,001 - 5,000 XLM',
      },
      {
        cap: 10000,
        bps: 20,
        percentage: '0.20%',
        range: '5,001 - 10,000 XLM',
      },
      {
        cap: Number.MAX_SAFE_INTEGER,
        bps: 10,
        percentage: '0.10%',
        range: '10,001+ XLM',
      },
    ];
  }
}
