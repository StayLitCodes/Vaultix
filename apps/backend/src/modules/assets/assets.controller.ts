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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

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
  @ApiOperation({ summary: 'List all active assets' })
  @ApiResponse({ status: 200, description: 'Assets retrieved successfully' })
  async findAllActive() {
    return this.assetsService.findAll(true);
  }

  @Get('balance')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the authenticated wallet balance for an asset' })
  @ApiQuery({ name: 'assetCode', required: true, description: 'Asset code to retrieve the balance for' })
  @ApiQuery({ name: 'issuer', required: false, description: 'Asset issuer for non-native assets' })
  @ApiResponse({ status: 200, description: 'Asset balance retrieved successfully' })
  @ApiResponse({ status: 400, description: 'Asset code is required' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
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
