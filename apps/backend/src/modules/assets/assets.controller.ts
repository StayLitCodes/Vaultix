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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

interface AuthenticatedRequest extends ExpressRequest {
  user: {
    userId: string;
    walletAddress: string;
    email: string;
    role: string;
  };
}

@Controller('assets')
@ApiTags('assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  async findAllActive() {
    return this.assetsService.findAll(true);
  }

  @Get('balance')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
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
