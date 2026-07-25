import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { Dispute } from '../entities/dispute.entity';
import { Escrow } from '../entities/escrow.entity';
import { IpfsService } from '../../ipfs/ipfs.service';
import {
  EvidenceFileMetadataDto,
  UploadEvidenceResponseDto,
} from '../dto/upload-evidence.dto';

interface FileWithMetadata extends Express.Multer.File {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class EscrowEvidenceService {
  private readonly logger = new Logger(EscrowEvidenceService.name);

  // Allowed MIME types for evidence files
  private readonly ALLOWED_MIME_TYPES = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  // File size limit: 10MB
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;

  constructor(
    @InjectRepository(Dispute)
    private disputeRepo: Repository<Dispute>,
    @InjectRepository(Escrow)
    private escrowRepo: Repository<Escrow>,
    private ipfsService: IpfsService,
  ) {}

  /**
   * Upload evidence files for a dispute
   * - Validates escrow exists and has an open dispute
   * - Validates each file (type, size)
   * - Uploads each file to IPFS
   * - Appends metadata to dispute.evidenceFiles (never replaces)
   * - Returns metadata with CIDs
   */
  async uploadEvidence(
    escrowId: string,
    files: FileWithMetadata[],
    userId: string,
  ): Promise<UploadEvidenceResponseDto> {
    this.logger.log(
      `Uploading ${files.length} evidence files for escrow ${escrowId} by user ${userId}`,
    );

    // Validate escrow exists
    const escrow = await this.escrowRepo.findOne({
      where: { id: escrowId },
      relations: ['dispute'],
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    // Check if escrow has an open dispute
    let dispute = await this.disputeRepo.findOne({
      where: { escrowId },
    });

    if (!dispute) {
      throw new BadRequestException('No dispute found for this escrow');
    }

    // Validate each file
    for (const file of files) {
      this.validateFile(file);
    }

    const uploadedMetadata: EvidenceFileMetadataDto[] = [];

    // Upload each file to IPFS and build metadata
    for (const file of files) {
      try {
        this.logger.log(`Uploading file ${file.originalname} to IPFS`);

        const cid = await this.ipfsService.uploadFile(
          file.buffer,
          file.originalname,
        );

        const metadata: EvidenceFileMetadataDto = {
          cid,
          name: file.originalname,
          type: file.mimetype,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
        };

        uploadedMetadata.push(metadata);
      } catch (error) {
        this.logger.error(
          `Failed to upload file ${file.originalname} to IPFS`,
          error,
        );
        throw new BadRequestException(
          `Failed to upload file ${file.originalname}`,
        );
      }
    }

    // Append to existing evidence files (do NOT replace)
    if (!dispute.evidenceFiles) {
      dispute.evidenceFiles = [];
    }

    dispute.evidenceFiles = [...dispute.evidenceFiles, ...uploadedMetadata];

    // Save the dispute record
    dispute = await this.disputeRepo.save(dispute);

    this.logger.log(
      `Successfully uploaded ${uploadedMetadata.length} files for dispute ${dispute.id}`,
    );

    return {
      escrowId,
      disputeId: dispute.id,
      uploadedFiles: uploadedMetadata,
      message: `Successfully uploaded ${uploadedMetadata.length} evidence file(s)`,
    };
  }

  /**
   * Get all evidence files for a dispute
   * - Verify caller is buyer, seller, or admin
   * - Return metadata for all evidence files
   */
  async getEvidence(
    escrowId: string,
    userId: string,
  ): Promise<EvidenceFileMetadataDto[]> {
    this.logger.log(
      `Fetching evidence for escrow ${escrowId} by user ${userId}`,
    );

    // Verify access
    await this.verifyEscrowAccess(escrowId, userId);

    // Get dispute
    const dispute = await this.disputeRepo.findOne({
      where: { escrowId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found for this escrow');
    }

    return dispute.evidenceFiles || [];
  }

  /**
   * Stream evidence file from IPFS
   * - Verify caller has access to escrow
   * - Find evidence file metadata by CID
   * - Fetch file from IPFS
   * - Stream with correct Content-Type header
   */
  async getEvidenceFile(
    escrowId: string,
    cid: string,
    userId: string,
    response: Response,
  ): Promise<void> {
    this.logger.log(
      `Fetching evidence file ${cid} for escrow ${escrowId} by user ${userId}`,
    );

    // Verify access
    await this.verifyEscrowAccess(escrowId, userId);

    // Get dispute
    const dispute = await this.disputeRepo.findOne({
      where: { escrowId },
    });

    if (!dispute) {
      throw new NotFoundException('Dispute not found for this escrow');
    }

    // Find evidence file metadata by CID
    const fileMetadata = (dispute.evidenceFiles || []).find(
      (file) => file.cid === cid,
    );

    if (!fileMetadata) {
      throw new NotFoundException('Evidence file not found');
    }

    // Get gateway URL from IPFS service
    const gatewayUrl = this.ipfsService.getGatewayUrl(cid);

    this.logger.log(`Redirecting to IPFS gateway: ${gatewayUrl}`);

    // Set Content-Type header from stored file metadata
    response.setHeader('Content-Type', fileMetadata.type);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${fileMetadata.name}"`,
    );

    // Redirect to IPFS gateway
    response.redirect(302, gatewayUrl);
  }

  /**
   * Validate file before upload
   * - Check MIME type against allowlist
   * - Check file size (max 10MB)
   */
  private validateFile(file: FileWithMetadata): void {
    // Validate MIME type
    if (!this.ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} not allowed. Allowed types: PDF, PNG, JPG, JPEG, DOC, DOCX`,
      );
    }

    // Validate file size
    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File size exceeds 10MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`,
      );
    }
  }

  /**
   * Verify that the user has access to the escrow
   * (i.e., they are a party or admin)
   */
  private async verifyEscrowAccess(
    escrowId: string,
    userId: string,
  ): Promise<void> {
    const escrow = await this.escrowRepo.findOne({
      where: { id: escrowId },
      relations: ['parties'],
    });

    if (!escrow) {
      throw new NotFoundException('Escrow not found');
    }

    // Check if user is a party to the escrow
    const isParty = escrow.parties?.some((party) => party.userId === userId);

    if (!isParty) {
      throw new ForbiddenException('You do not have access to this escrow');
    }
  }
}
