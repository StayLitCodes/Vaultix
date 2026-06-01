import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Req,
  Res,
  ForbiddenException,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
  StreamableFile,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request as ExpressRequest, Response } from 'express';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { EscrowAccessGuard } from '../guards/escrow-access.guard';
import { EscrowExpireGuard } from '../guards/escrow-expire.guard';
import { EscrowService } from '../services/escrow.service';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { UpdateEscrowDto } from '../dto/update-escrow.dto';
import { ListEscrowsDto } from '../dto/list-escrows.dto';
import { ListEventsDto } from '../dto/list-events.dto';
import { CancelEscrowDto } from '../dto/cancel-escrow.dto';
import {
  EscrowOverviewQueryDto,
  EscrowOverviewResponseDto,
} from '../dto/escrow-overview.dto';
import { FulfillConditionDto } from '../dto/fulfill-condition.dto';
import { FileDisputeDto, ResolveDisputeDto } from '../dto/dispute.dto';
import { FundEscrowDto } from '../dto/fund-escrow.dto';
import { ExpireEscrowDto } from '../dto/expire-escrow.dto';
import { ProposeMilestoneChangeDto } from '../dto/milestone-change.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: { sub?: string; userId?: string; walletAddress: string };
}

interface EvidenceUploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_EVIDENCE_FILES = 5;
const ALLOWED_EVIDENCE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpg',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
const ALLOWED_EVIDENCE_EXTENSIONS = new Set([
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'doc',
  'docx',
]);

function evidenceFileFilter(
  _req: ExpressRequest,
  file: { originalname: string; mimetype: string },
  callback: (error: Error | null, acceptFile: boolean) => void,
) {
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  const hasAllowedExtension =
    extension !== undefined && ALLOWED_EVIDENCE_EXTENSIONS.has(extension);

  if (
    !ALLOWED_EVIDENCE_MIME_TYPES.has(file.mimetype) ||
    !hasAllowedExtension
  ) {
    callback(
      new BadRequestException(
        'Evidence must be a PDF, PNG, JPG, JPEG, DOC, or DOCX file',
      ),
      false,
    );
    return;
  }

  callback(null, true);
}

@Controller('escrows')
@ApiTags('escrows')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard, AuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  private getAuthenticatedUserId(req: AuthenticatedRequest): string {
    const userId = req.user.sub ?? req.user.userId;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    return userId;
  }

  @Post(':id/evidence')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'files', maxCount: MAX_EVIDENCE_FILES },
        { name: 'file', maxCount: MAX_EVIDENCE_FILES },
      ],
      {
        limits: {
          fileSize: MAX_EVIDENCE_FILE_SIZE,
          files: MAX_EVIDENCE_FILES,
        },
        fileFilter: evidenceFileFilter,
      },
    ),
  )
  async uploadEvidence(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @UploadedFiles()
    uploadedFiles: {
      files?: EvidenceUploadFile[];
      file?: EvidenceUploadFile[];
    },
  ) {
    uploadedFiles = uploadedFiles ?? {};
    const files = [
      ...(uploadedFiles.files ?? []),
      ...(uploadedFiles.file ?? []),
    ];

    if (files.length === 0) {
      throw new BadRequestException('At least one evidence file is required');
    }

    if (files.length > MAX_EVIDENCE_FILES) {
      throw new BadRequestException(
        `A maximum of ${MAX_EVIDENCE_FILES} evidence files can be uploaded`,
      );
    }

    return this.escrowService.uploadEvidence(
      id,
      this.getAuthenticatedUserId(req),
      files,
      req.ip || req.socket?.remoteAddress,
    );
  }

  @Get(':id/evidence')
  async listEvidence(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.listEvidence(
      id,
      this.getAuthenticatedUserId(req),
    );
  }

  @Get(':id/evidence/:cid')
  async getEvidenceFile(
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Request() req: AuthenticatedRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const evidenceFile = await this.escrowService.getEvidenceFile(
      id,
      this.getAuthenticatedUserId(req),
      cid,
    );

    res.setHeader(
      'Content-Type',
      evidenceFile.metadata.type || evidenceFile.contentType,
    );
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${evidenceFile.metadata.name.replace(/"/g, '\\"')}"`,
    );

    if (evidenceFile.contentLength) {
      res.setHeader('Content-Length', evidenceFile.contentLength.toString());
    }

    return new StreamableFile(evidenceFile.stream);
  }

  @Post()
  async create(
    @Body() dto: CreateEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.create(dto, userId, ipAddress);
  }

  @Get()
  async findAll(
    @Query() query: ListEscrowsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    return this.escrowService.findAll(userId, query);
  }

  @Get('overview')
  @ApiOperation({
    summary: 'Get paginated escrow overview for authenticated user dashboard',
  })
  @ApiOkResponse({ type: EscrowOverviewResponseDto })
  async findOverview(
    @Query() query: EscrowOverviewQueryDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    return this.escrowService.findOverview(userId, query);
  }

  @Get(':id')
  @UseGuards(EscrowAccessGuard)
  async findOne(@Param('id') id: string) {
    return this.escrowService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(EscrowAccessGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.update(id, dto, userId, ipAddress);
  }

  @Post(':id/cancel')
  @UseGuards(EscrowAccessGuard)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.cancel(id, dto, userId, ipAddress);
  }

  @Post(':id/expire')
  @UseGuards(EscrowExpireGuard)
  async expire(
    @Param('id') id: string,
    @Body() dto: ExpireEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;

    return this.escrowService.expire(id, dto, userId, ipAddress);
  }

  @Get(':id/events')
  @UseGuards(EscrowAccessGuard)
  async findEscrowEvents(
    @Param('id') id: string,
    @Query() query: ListEventsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    return this.escrowService.findEvents(userId, query, id);
  }

  @Post(':id/fund')
  @UseGuards(EscrowAccessGuard)
  async fund(
    @Param('id') id: string,
    @Body() dto: FundEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.fund(
      id,
      dto,
      this.getAuthenticatedUserId(req),
      req.user.walletAddress,
      ipAddress,
    );
  }

  @Post(':id/release')
  @UseGuards(AuthGuard)
  async releaseEscrow(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const escrow = await this.escrowService.releaseEscrow(
      id,
      this.getAuthenticatedUserId(req),
      true, // manual trigger
    );

    return {
      id: escrow.id,
      status: escrow.status,
      transactionHash: escrow.releaseTransactionHash,
    };
  }

  @Post(':id/conditions/:conditionId/fulfill')
  @UseGuards(EscrowAccessGuard)
  async fulfillCondition(
    @Param('id') escrowId: string,
    @Param('conditionId') conditionId: string,
    @Body() dto: FulfillConditionDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.fulfillCondition(
      escrowId,
      conditionId,
      dto,
      userId,
      ipAddress,
    );
  }

  @Post(':id/conditions/:conditionId/confirm')
  @UseGuards(EscrowAccessGuard)
  async confirmCondition(
    @Param('id') escrowId: string,
    @Param('conditionId') conditionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.confirmCondition(
      escrowId,
      conditionId,
      userId,
      ipAddress,
    );
  }

  @Post(':id/conditions/:conditionId/propose')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Propose a change to a pending milestone' })
  async proposeMilestoneChange(
    @Param('id') escrowId: string,
    @Param('conditionId') conditionId: string,
    @Body() dto: ProposeMilestoneChangeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.proposeMilestoneChange(
      escrowId,
      conditionId,
      dto,
      this.getAuthenticatedUserId(req),
    );
  }

  @Post(':id/conditions/:conditionId/accept')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Accept a proposed change to a milestone' })
  async acceptMilestoneChange(
    @Param('id') escrowId: string,
    @Param('conditionId') conditionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.acceptMilestoneChange(
      escrowId,
      conditionId,
      this.getAuthenticatedUserId(req),
    );
  }

  /**
   * POST /escrows/:id/dispute
   * File a dispute against an active escrow. Only a buyer or seller party may call this.
   * Transitions the escrow from ACTIVE → DISPUTED and freezes fund release.
   */
  @Post(':id/dispute')
  @UseGuards(EscrowAccessGuard)
  async fileDispute(
    @Param('id') id: string,
    @Body() dto: FileDisputeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.fileDispute(
      id,
      this.getAuthenticatedUserId(req),
      dto,
      ipAddress,
    );
  }

  /**
   * GET /escrows/:id/dispute
   * Retrieve the dispute record for an escrow. Accessible to any party on the escrow.
   */
  @Get(':id/dispute')
  @UseGuards(EscrowAccessGuard)
  async getDispute(@Param('id') id: string) {
    return this.escrowService.getDispute(id);
  }

  /**
   * POST /escrows/:id/dispute/resolve
   * Resolve an open dispute. Only an assigned arbitrator party may call this.
   * Transitions the escrow from DISPUTED → COMPLETED (release/split) or CANCELLED (refund).
   */
  @Post(':id/dispute/resolve')
  @UseGuards(EscrowAccessGuard)
  async resolveDispute(
    @Param('id') id: string,
    @Body() dto: ResolveDisputeDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.resolveDispute(
      id,
      this.getAuthenticatedUserId(req),
      dto,
      ipAddress,
    );
  }
}
