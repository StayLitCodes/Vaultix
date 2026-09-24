import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { KycService } from '../services/kyc.service';
import { InitiateKycDto } from '../dto/kyc.dto';

@ApiTags('KYC')
@Controller('kyc')
@UseGuards(AuthGuard)
@ApiBearerAuth()
export class KycController {
  constructor(private readonly kycService: KycService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get current KYC verification status',
    description:
      'Returns the current KYC status for the authenticated user.',
  })
  async getStatus(
    @Req() req: Request & { user: { userId: string } },
  ) {
    return this.kycService.getKycStatus(req.user.userId);
  }

  @Post('initiate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @ApiOperation({
    summary: 'Initiate KYC verification',
    description:
      'Starts a new KYC verification process for the authenticated user. ' +
      'Returns a redirect URL for the verification flow.',
  })
  async initiateVerification(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: InitiateKycDto,
  ) {
    return this.kycService.initiateVerification(
      req.user.userId,
      dto,
    );
  }
}
