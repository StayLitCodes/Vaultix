import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { KycService } from '../../kyc/services/kyc.service';
import { KycStatus } from '../../kyc/entities/kyc-verification.entity';
import { AdminAuditLogService } from '../services/admin-audit-log.service';
import { AdminUpdateKycDto, AdminKycQueryDto } from '../../kyc/dto/kyc.dto';

/**
 * Admin controller for managing KYC verifications.
 *
 * All endpoints require admin or super_admin role.
 * All mutations are audited via AdminAuditLogService.
 */
@ApiTags('Admin - KYC')
@Controller('admin/kyc')
@UseGuards(AuthGuard, AdminGuard)
@ApiBearerAuth()
export class AdminKycController {
  constructor(
    private readonly kycService: KycService,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {}

  @Get('users')
  @ApiOperation({
    summary: 'List all users with their KYC status',
    description:
      'Returns paginated list of users with KYC status. ' +
      'Filter by status using ?status=verified|pending|rejected|not_started',
  })
  async getKycUsers(@Query() query: AdminKycQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.kycService.getAdminKycList(query.status, page, limit);
  }

  @Patch('users/:id/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually update a user KYC status',
    description:
      'Override a user KYC status. Use with caution. ' +
      'All changes are audited.',
  })
  async updateKycStatus(
    @Param('id') userId: string,
    @Body() dto: AdminUpdateKycDto,
    @Req() req: Request & { user?: { userId: string } },
  ) {
    const actorId = dto.actorId || req.user?.userId || 'system';

    const { user, oldStatus } = await this.kycService.adminUpdateKycStatus(
      userId,
      dto.status as KycStatus,
      dto.reason,
    );

    // Audit log entry
    await this.adminAuditLogService.create({
      actorId,
      actionType: 'UPDATE_KYC_STATUS',
      resourceType: 'USER',
      resourceId: user.id,
      metadata: {
        oldStatus,
        newStatus: user.kycStatus,
        reason: dto.reason,
      },
    });

    return {
      message: `User ${userId} KYC status updated to ${dto.status}`,
      user: {
        id: user.id,
        walletAddress: user.walletAddress,
        kycStatus: user.kycStatus,
      },
    };
  }
}
