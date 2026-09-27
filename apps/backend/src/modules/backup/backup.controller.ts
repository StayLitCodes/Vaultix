import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { AdminGuard } from '../auth/middleware/admin.guard';
import { BackupService } from './services/backup.service';
import { TriggerBackupDto, BackupStatusResponse } from './dto/backup.dto';

@ApiTags('admin/backup')
@ApiBearerAuth()
@UseGuards(AuthGuard, AdminGuard)
@Controller('admin/backup')
export class BackupController {
  private readonly logger = new Logger(BackupController.name);

  constructor(private readonly backupService: BackupService) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger a manual database backup',
    description:
      'Creates a backup of the SQLite database with optional encryption and S3 upload.',
  })
  @ApiOkResponse({
    description: 'Backup completed successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        filename: { type: 'string' },
        sizeBytes: { type: 'number' },
        status: { type: 'string', enum: ['completed'] },
        encrypted: { type: 'boolean' },
        localPath: { type: 'string', nullable: true },
        remotePath: { type: 'string', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiInternalServerErrorResponse({
    description: 'Backup failed',
  })
  async triggerBackup(@Body() dto: TriggerBackupDto) {
    this.logger.log('Manual backup triggered via admin endpoint');
    const record = await this.backupService.triggerBackup(dto);

    return {
      id: record.id,
      filename: record.filename,
      sizeBytes: record.sizeBytes,
      status: record.status,
      encrypted: record.encrypted,
      localPath: record.localPath,
      remotePath: record.remotePath,
      createdAt: record.createdAt.toISOString(),
    };
  }

  @Get('status')
  @ApiOperation({
    summary: 'Get backup status and storage information',
    description:
      'Returns the last backup time, size, storage quota usage, and retention summary.',
  })
  @ApiOkResponse({
    description: 'Backup status retrieved successfully',
  })
  async getBackupStatus(): Promise<BackupStatusResponse> {
    return this.backupService.getBackupStatus();
  }

  @Post(':id/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify backup integrity',
    description:
      'Restores the backup to a temporary location and verifies the checksum matches.',
  })
  @ApiParam({
    name: 'id',
    description: 'Backup record UUID',
  })
  @ApiOkResponse({
    description: 'Verification result',
    schema: {
      type: 'object',
      properties: {
        verified: { type: 'boolean' },
        originalChecksum: { type: 'string' },
        restoreChecksum: { type: 'string' },
        verifiedAt: { type: 'string', format: 'date-time' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Backup not found or file missing',
  })
  async verifyBackup(@Param('id') id: string) {
    this.logger.log(`Backup verification requested for: ${id}`);
    return this.backupService.verifyBackup(id);
  }

  @Post('retention/apply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Apply retention policy',
    description:
      'Removes expired backups based on the retention policy (daily: 7d, weekly: 4w, monthly: 12m).',
  })
  @ApiOkResponse({
    description: 'Retention policy applied',
    schema: {
      type: 'object',
      properties: {
        deletedCount: { type: 'number' },
        deletedIds: {
          type: 'array',
          items: { type: 'string', format: 'uuid' },
        },
      },
    },
  })
  async applyRetentionPolicy() {
    this.logger.log('Retention policy manually triggered');
    return this.backupService.applyRetentionPolicy();
  }
}
