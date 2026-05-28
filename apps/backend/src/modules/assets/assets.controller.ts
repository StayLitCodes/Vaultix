import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { AssetsService } from './assets.service';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiOkResponse, ApiUnauthorizedResponse, ApiBadRequestResponse, ApiQuery } from '@nestjs/swagger';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    walletAddress: string;
    email: string;
    role: string;
  };
}

@Controller('assets')
@ApiTags('Assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiOperation({ summary: 'List active assets', description: 'Retrieves all currently active assets supported by the platform.' })
  @ApiOkResponse({ description: 'List of active assets retrieved' })
  async findAllActive() {
    return this.assetsService.findAll(true);
  }

  @Get('balance')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get asset balance', description: 'Retrieves the balance of a specific asset for the authenticated user.' })
  @ApiQuery({ name: 'assetCode', required: true, example: 'USDC' })
  @ApiQuery({ name: 'issuer', required: false, example: 'GBBD...' })
  @ApiOkResponse({ description: 'Asset balance retrieved' })
  @ApiBadRequestResponse({ description: 'assetCode query parameter is required' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getBalance(
    @Query('assetCode') assetCode: string,
    @Query('issuer') issuer: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!assetCode) {
      throw new BadRequestException('assetCode query parameter is required');
    }
    const walletAddress = req.user.walletAddress;
    return this.assetsService.getBalance(walletAddress, assetCode, issuer);
  }
}
