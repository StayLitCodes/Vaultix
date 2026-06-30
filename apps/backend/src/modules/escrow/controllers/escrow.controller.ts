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
  ForbiddenException,
  UseInterceptors,
  UploadedFiles,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Res,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Response } from 'express';
import { Request as ExpressRequest } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { EscrowAccessGuard } from '../guards/escrow-access.guard';
import { EscrowExpireGuard } from '../guards/escrow-expire.guard';
import { EscrowService } from '../services/escrow.service';
import { EscrowEvidenceService } from '../services/escrow-evidence.service';
import { IpfsService } from '../../ipfs/ipfs.service';
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
import {
  EvidenceFileMetadataDto,
  UploadEvidenceResponseDto,
} from '../dto/upload-evidence.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: { sub?: string; userId?: string; walletAddress: string };
}

@Controller('escrows')
@ApiTags('escrows')
@ApiBearerAuth('access-token')
@UseGuards(ThrottlerGuard, AuthGuard)
export class EscrowController {
  constructor(
    private readonly escrowService: EscrowService,
    private readonly evidenceService: EscrowEvidenceService,
    private readonly ipfsService: IpfsService,
  ) {}

  private getAuthenticatedUserId(req: AuthenticatedRequest): string {
    const userId = req.user.sub ?? req.user.userId;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    return userId;
  }

  @Post()
  @ApiOperation({ summary: 'Create a new escrow' })
  @ApiBody({ type: CreateEscrowDto, description: 'Escrow creation payload' })
  @ApiResponse({ status: 201, description: 'Escrow created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid escrow payload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 409, description: 'Escrow conflicts with an existing resource' })
  async create(
    @Body() dto: CreateEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.create(dto, userId, ipAddress);
  }

  @Get()
  @ApiOperation({ summary: 'List escrows for the authenticated user' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by escrow status' })
  @ApiResponse({ status: 200, description: 'Escrows retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
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

  @Get('pending-invitations')
  @ApiOperation({
    summary:
      'List escrows where the authenticated user has a pending party invitation',
  })
  async getPendingInvitations(@Request() req: AuthenticatedRequest) {
    return this.escrowService.getPendingInvitations(
      this.getAuthenticatedUserId(req),
    );
  }

  @Get(':id')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Get a single escrow by ID' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiResponse({ status: 200, description: 'Escrow retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  async findOne(@Param('id') id: string) {
    return this.escrowService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Update an escrow by ID' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiBody({ type: UpdateEscrowDto, description: 'Escrow update payload' })
  @ApiResponse({ status: 200, description: 'Escrow updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid update payload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
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
  @ApiOperation({ summary: 'Cancel an escrow by ID' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiBody({ type: CancelEscrowDto, description: 'Escrow cancellation payload' })
  @ApiResponse({ status: 200, description: 'Escrow cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid cancellation payload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
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
  @ApiOperation({ summary: 'Expire an escrow by ID' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiBody({ type: ExpireEscrowDto, description: 'Escrow expiration payload' })
  @ApiResponse({ status: 200, description: 'Escrow expired successfully' })
  @ApiResponse({ status: 400, description: 'Invalid expiration payload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
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
  @ApiOperation({ summary: 'List events for an escrow' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size' })
  @ApiResponse({ status: 200, description: 'Escrow events retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
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
  @ApiOperation({ summary: 'Fund an escrow' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiBody({ type: FundEscrowDto, description: 'Funding request payload' })
  @ApiResponse({ status: 200, description: 'Escrow funded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid funding payload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
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
  @ApiOperation({ summary: 'Release funds for an escrow' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiResponse({ status: 200, description: 'Escrow released successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
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
  @ApiOperation({ summary: 'Fulfill an escrow condition' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiParam({ name: 'conditionId', description: 'Condition ID' })
  @ApiBody({ type: FulfillConditionDto, description: 'Condition fulfillment payload' })
  @ApiResponse({ status: 200, description: 'Condition fulfilled successfully' })
  @ApiResponse({ status: 400, description: 'Invalid fulfillment payload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Condition or escrow not found' })
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
  @ApiOperation({ summary: 'Confirm a fulfilled condition' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiParam({ name: 'conditionId', description: 'Condition ID' })
  @ApiResponse({ status: 200, description: 'Condition confirmed successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Condition or escrow not found' })
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

  @Post(':id/conditions/:conditionId/release')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Release a specific milestone payment' })
  async releaseMilestone(
    @Param('id') escrowId: string,
    @Param('conditionId') conditionId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.escrowService.releaseMilestone(
      escrowId,
      conditionId,
      this.getAuthenticatedUserId(req),
    );
  }

  @Post(':id/parties/:partyId/accept')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Accept a party invitation for an escrow' })
  async acceptPartyInvitation(
    @Param('id') escrowId: string,
    @Param('partyId') partyId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.acceptPartyInvitation(
      escrowId,
      partyId,
      this.getAuthenticatedUserId(req),
      ipAddress,
    );
  }

  @Post(':id/parties/:partyId/reject')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Reject a party invitation for an escrow' })
  async rejectPartyInvitation(
    @Param('id') escrowId: string,
    @Param('partyId') partyId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.rejectPartyInvitation(
      escrowId,
      partyId,
      this.getAuthenticatedUserId(req),
      ipAddress,
    );
  }

  /**
   * POST /escrows/:id/dispute
   * File a dispute against an active escrow. Only a buyer or seller party may call this.
   * Transitions the escrow from ACTIVE → DISPUTED and freezes fund release.
   */
  @Post(':id/dispute')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'File a dispute for an escrow' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiBody({ type: FileDisputeDto, description: 'Dispute filing payload' })
  @ApiResponse({ status: 200, description: 'Dispute filed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid dispute payload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
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
  @ApiOperation({ summary: 'Get the dispute record for an escrow' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiResponse({ status: 200, description: 'Dispute retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow or dispute not found' })
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
  @ApiOperation({ summary: 'Resolve an escrow dispute' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiBody({ type: ResolveDisputeDto, description: 'Dispute resolution payload' })
  @ApiResponse({ status: 200, description: 'Dispute resolved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid dispute resolution payload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow or dispute not found' })
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
  /**
   * POST /escrows/:id/evidence
   * Upload evidence files for a dispute. Accepts up to 5 files, max 10MB each.
   * Only dispute parties may call this.
   */
  @Post(':id/evidence')
  @UseGuards(EscrowAccessGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload evidence for an escrow' })
  @ApiParam({ name: 'id', description: 'Escrow ID' })
  @ApiResponse({ status: 201, description: 'Evidence uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid evidence file upload' })
  @ApiResponse({ status: 401, description: 'Authentication required' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Escrow not found' })
  @ApiOperation({ summary: 'Upload evidence files for a dispute' })
  @ApiOkResponse({ type: UploadEvidenceResponseDto })
  async uploadEvidence(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
    @UploadedFiles(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB per file
          new FileTypeValidator({
            fileType: /(pdf|png|jpg|jpeg|doc|docx)$/,
          }),
        ],
      }),
    )
    files: Express.Multer.File[],
  ): Promise<UploadEvidenceResponseDto> {
    const userId = this.getAuthenticatedUserId(req);
    return this.evidenceService.uploadEvidence(id, files, userId);
  }

  /**
   * GET /escrows/:id/evidence
   * Get all evidence file metadata for a dispute. Accessible to dispute parties.
   */
  @Get(':id/evidence')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Get evidence files for a dispute' })
  @ApiOkResponse({ type: [EvidenceFileMetadataDto] })
  async getEvidence(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ): Promise<EvidenceFileMetadataDto[]> {
    const userId = this.getAuthenticatedUserId(req);
    return this.evidenceService.getEvidence(id, userId);
  }

  /**
   * GET /escrows/:id/evidence/:cid
   * Stream evidence file from IPFS by CID. Accessible to dispute parties.
   */
  @Get(':id/evidence/:cid')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Stream evidence file from IPFS' })
  async getEvidenceFile(
    @Param('id') id: string,
    @Param('cid') cid: string,
    @Request() req: AuthenticatedRequest,
    @Res() res: Response,
  ): Promise<void> {
    const userId = this.getAuthenticatedUserId(req);
    await this.evidenceService.getEvidenceFile(id, cid, userId, res);
  }

  /**
   * GET /escrows/:id/metadata
   * Get escrow metadata from IPFS
   */
  @Get(':id/metadata')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Get escrow metadata from IPFS' })
  async getEscrowMetadata(@Param('id') id: string) {
    return this.ipfsService.getMetadata(id);
  }

  /**
   * GET /escrows/:id/metadata/verify
   * Verify escrow metadata integrity
   */
  @Get(':id/metadata/verify')
  @UseGuards(EscrowAccessGuard)
  @ApiOperation({ summary: 'Verify escrow metadata integrity' })
  async verifyEscrowMetadata(@Param('id') id: string) {
    return this.ipfsService.verifyMetadata(id);
  }

  /**
   * POST /escrows/:id/metadata/pin
   * Pin escrow metadata to IPFS (admin only)
   */
  @Post(':id/metadata/pin')
  @UseGuards(EscrowAccessGuard, AdminGuard)
  @ApiOperation({ summary: 'Pin escrow metadata to IPFS (admin only)' })
  async pinEscrowMetadata(
    @Param('id') id: string,
    @Body() metadata?: Record<string, unknown>,
  ) {
    return this.ipfsService.pinMetadata(id, metadata || {});
  }
}
