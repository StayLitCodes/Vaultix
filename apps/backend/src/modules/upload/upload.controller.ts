import {
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Request,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request as ExpressRequest, Response } from 'express';
import { memoryStorage } from 'multer';
import { ThrottlerGuard } from '@nestjs/throttler';

import { AuthGuard } from '../auth/middleware/auth.guard';
import { AdminGuard } from '../auth/middleware/admin.guard';
import { UploadRateLimitGuard } from './guards/upload-rate-limit.guard';
import { UploadService } from './upload.service';
import {
  DeleteEvidenceResponseDto,
  EvidenceMetadataDto,
  ListEvidenceQueryDto,
  UploadEvidenceResponseDto,
} from './dto/upload.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: { sub?: string; userId?: string; walletAddress: string };
}

@Controller('disputes')
@ApiTags('disputes / evidence')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard, AuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  private getUserId(req: AuthenticatedRequest): string {
    const id = req.user?.sub ?? req.user?.userId;
    if (!id) throw new ForbiddenException('User not authenticated');
    return id;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // POST /disputes/:id/evidence
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Upload up to 10 evidence files for an open dispute.
   * Accepted types: PNG, JPG, WebP, PDF, TXT, DOCX.
   * Max 10 MB per file. Rate-limited to 20 uploads/hour/user.
   */
  @Post(':id/evidence')
  @UseGuards(UploadRateLimitGuard)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 }, // multer-level size guard
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload evidence files for a dispute',
    description:
      'Accepts up to 10 files (PNG/JPG/WebP/PDF/TXT/DOCX), max 10 MB each. ' +
      'MIME type is verified via magic bytes server-side. ' +
      'Images get a 200×200 thumbnail. Rate limited: 20 uploads/hour/user.',
  })
  @ApiOkResponse({ type: UploadEvidenceResponseDto })
  async uploadEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
    @Request() req: AuthenticatedRequest,
  ): Promise<UploadEvidenceResponseDto> {
    return this.uploadService.uploadEvidence(id, files, this.getUserId(req));
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /disputes/:id/evidence
  // ──────────────────────────────────────────────────────────────────────────

  @Get(':id/evidence')
  @ApiOperation({ summary: 'List evidence files for a dispute' })
  @ApiOkResponse({ type: [EvidenceMetadataDto] })
  async listEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListEvidenceQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<EvidenceMetadataDto[]> {
    return this.uploadService.listEvidence(id, this.getUserId(req), query);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /disputes/:id/evidence/:evidenceId/download
  // ──────────────────────────────────────────────────────────────────────────

  @Get(':id/evidence/:evidenceId/download')
  @ApiOperation({ summary: 'Download a single evidence file' })
  async downloadEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.uploadService.downloadEvidence(
      id,
      evidenceId,
      this.getUserId(req),
      res,
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /disputes/:id/evidence/:evidenceId  (admin only)
  // ──────────────────────────────────────────────────────────────────────────

  @Delete(':id/evidence/:evidenceId')
  @UseGuards(AdminGuard)
  @ApiOperation({
    summary: 'Admin: soft-delete an evidence file',
    description: 'Marks the record as deleted and removes the physical file.',
  })
  @ApiOkResponse({ type: DeleteEvidenceResponseDto })
  async deleteEvidence(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('evidenceId', ParseUUIDPipe) evidenceId: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<DeleteEvidenceResponseDto> {
    return this.uploadService.deleteEvidence(id, evidenceId, this.getUserId(req));
  }
}
