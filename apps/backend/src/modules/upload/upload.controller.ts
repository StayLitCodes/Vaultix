import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  Res,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import { memoryStorage } from 'multer';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { AdminGuard } from '../auth/middleware/admin.guard';
import { DisputeAccessGuard } from './guards/dispute-access.guard';
import { UploadRateLimitGuard } from './guards/upload-rate-limit.guard';
import { UploadService } from './upload.service';

interface AuthenticatedRequest extends ExpressRequest {
  user: { sub?: string; userId?: string; walletAddress: string };
}

@Controller('disputes')
@ApiTags('dispute-evidence')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  private getUserId(req: AuthenticatedRequest): string {
    const id = req.user.sub ?? req.user.userId;
    if (!id) throw new ForbiddenException('User not authenticated');
    return id;
  }

  @Post(':id/evidence')
  @UseGuards(DisputeAccessGuard, UploadRateLimitGuard)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  @ApiOperation({ summary: 'Upload evidence file for a dispute' })
  @ApiConsumes('multipart/form-data')
  async upload(
    @Param('id') disputeId: string,
    @Request() req: AuthenticatedRequest,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new ForbiddenException('No file provided');
    }
    return this.uploadService.uploadEvidence(
      disputeId,
      this.getUserId(req),
      file,
    );
  }

  @Get(':id/evidence')
  @UseGuards(DisputeAccessGuard)
  @ApiOperation({ summary: 'List evidence files for a dispute' })
  async list(@Param('id') disputeId: string) {
    return this.uploadService.listEvidence(disputeId);
  }

  @Get(':id/evidence/:evidenceId/download')
  @UseGuards(DisputeAccessGuard)
  @ApiOperation({ summary: 'Download a specific evidence file' })
  async download(
    @Param('id') disputeId: string,
    @Param('evidenceId') evidenceId: string,
    @Res() res: Response,
  ) {
    const { stream, evidence } = await this.uploadService.downloadEvidence(
      disputeId,
      evidenceId,
    );

    res.set({
      'Content-Type': evidence.mimeType,
      'Content-Disposition': `attachment; filename="${evidence.originalName}"`,
      'Content-Length': String(evidence.size),
    });

    stream.pipe(res);
  }

  @Delete(':id/evidence/:evidenceId')
  @UseGuards(DisputeAccessGuard, AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an evidence file (admin only)' })
  async remove(
    @Param('id') disputeId: string,
    @Param('evidenceId') evidenceId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.uploadService.deleteEvidence(
      disputeId,
      evidenceId,
      this.getUserId(req),
    );
  }
}
