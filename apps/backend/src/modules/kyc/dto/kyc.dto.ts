import {
  IsOptional,
  IsString,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { KycProvider } from '../entities/kyc-verification.entity';

export class InitiateKycDto {
  @ApiPropertyOptional({
    description: 'KYC provider to use',
    enum: KycProvider,
    default: KycProvider.MOCK,
  })
  @IsOptional()
  @IsEnum(KycProvider)
  provider?: KycProvider;

  @ApiPropertyOptional({
    description: 'Redirect path after verification is complete',
    example: '/dashboard',
  })
  @IsOptional()
  @IsString()
  redirectPath?: string;
}

export class KycStatusResponseDto {
  status!: string;
  provider?: string;
  initiatedAt?: Date;
  completedAt?: Date;
  rejectionReason?: string;
}

export class KycInitiateResponseDto {
  verificationId!: string;
  redirectUrl!: string;
  expiresAt?: Date;
}

export class KycWebhookPayloadDto {
  @ApiPropertyOptional({
    description: 'The provider-issued verification ID',
  })
  @IsString()
  verificationId!: string;

  @ApiPropertyOptional({
    description: 'The new status',
    enum: ['verified', 'rejected', 'pending', 'expired'],
  })
  @IsString()
  status!: string;

  @ApiPropertyOptional({
    description: 'Reason for rejection',
  })
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class AdminUpdateKycDto {
  @ApiPropertyOptional({
    description: 'Target KYC status',
    enum: ['verified', 'rejected', 'pending', 'not_started'],
  })
  @IsString()
  status!: string;

  @ApiPropertyOptional({
    description: 'Reason for the status change',
  })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({
    description: 'Admin actor ID for audit logging',
  })
  @IsOptional()
  @IsUUID()
  actorId?: string;
}

export class AdminKycQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by KYC status',
    enum: ['verified', 'rejected', 'pending', 'not_started'],
  })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
  })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
  })
  @IsOptional()
  limit?: number;
}
