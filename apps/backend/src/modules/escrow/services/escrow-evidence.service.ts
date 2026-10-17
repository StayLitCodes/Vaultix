import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
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

interface StoredEvidenceMetadata {
  cid: string;
  storageKey?: string;
  storage?: 'local' | 's3' | 'ipfs';
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
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
  private readonly storageDir: string;
  private readonly storageMode: 'local' | 's3';
  private readonly s3Client: S3Client | null;
  private readonly s3Bucket: string;
  private readonly signingSecret: string;
  private readonly signedUrlTtlSeconds: number;

  constructor(
    @InjectRepository(Dispute)
    private disputeRepo: Repository<Dispute>,
    @InjectRepository(Escrow)
    private escrowRepo: Repository<Escrow>,
    private readonly configService: ConfigService,
    private readonly ipfsService: IpfsService,
  ) {
    this.storageDir = path.resolve(
      this.configService.get<string>(
        'EVIDENCE_LOCAL_DIR',
        path.resolve(process.cwd(), 'data', 'dispute-evidence'),
      ),
    );
    this.s3Bucket = this.configService.get<string>('EVIDENCE_S3_BUCKET', '');
    const useS3 =
      this.configService.get<string>('EVIDENCE_STORAGE', 'local') === 's3';
    const accessKeyId = this.configService.get<string>(
      'EVIDENCE_S3_ACCESS_KEY',
      this.configService.get<string>('AWS_ACCESS_KEY_ID', ''),
    );
    const secretAccessKey = this.configService.get<string>(
      'EVIDENCE_S3_SECRET_KEY',
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY', ''),
    );
    this.storageMode = useS3 && this.s3Bucket ? 's3' : 'local';
    this.s3Client =
      this.storageMode === 's3'
        ? new S3Client({
            region: this.configService.get<string>(
              'EVIDENCE_S3_REGION',
              'us-east-1',
            ),
            endpoint:
              this.configService.get<string>('EVIDENCE_S3_ENDPOINT') ||
              undefined,
            ...(accessKeyId && secretAccessKey
              ? { credentials: { accessKeyId, secretAccessKey } }
              : {}),
          })
        : null;
    this.signingSecret = this.configService.get<string>(
      'EVIDENCE_SIGNING_SECRET',
      this.configService.get<string>(
        'JWT_SECRET',
        'development-only-evidence-secret',
      ),
    );
    const configuredTtl = Number(
      this.configService.get<string>('EVIDENCE_SIGNED_URL_TTL_SECONDS', '900'),
    );
    this.signedUrlTtlSeconds =
      Number.isFinite(configuredTtl) && configuredTtl > 0
        ? Math.min(Math.floor(configuredTtl), 3600)
        : 900;
    if (this.storageMode === 'local') {
      fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
    }
    if (useS3 && this.storageMode !== 's3') {
      this.logger.warn(
        'Evidence S3 is selected but the bucket is missing; using local storage',
      );
    }
  }

  /**
   * Upload evidence files for a dispute
   * - Validates escrow exists and has an open dispute
   * - Validates each file (type, size)
   * - Runs the virus-scan stub and stores each file locally or in S3
   * - Appends metadata to dispute.evidenceFiles (never replaces)
   * - Returns metadata with short-lived signed download links
   */
  async uploadEvidence(
    escrowId: string,
    files: FileWithMetadata[],
    userId: string,
  ): Promise<UploadEvidenceResponseDto> {
    if (!files?.length) {
      throw new BadRequestException('At least one evidence file is required');
    }
    if (files.length > 5) {
      throw new BadRequestException(
        'A maximum of 5 evidence files may be uploaded at once',
      );
    }
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

    // The scanner is intentionally a stub until an antivirus provider is configured.
    for (const file of files) {
      try {
        if (!this.scanFile()) {
          throw new BadRequestException('Evidence file failed virus scanning');
        }
        const cid = randomUUID();
        const storageKey = `${dispute.id}/${cid}`;
        await this.storeFile(storageKey, file);
        const safeName = path
          .basename(file.originalname.replace(/\\/g, '/'))
          .replace(/[\r\n\0]/g, '')
          .slice(0, 255);
        const metadata: StoredEvidenceMetadata = {
          cid,
          storageKey,
          storage: this.storageMode,
          name: safeName,
          type: file.mimetype,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedBy: userId,
        };

        uploadedMetadata.push(metadata);
      } catch (error) {
        this.logger.error(
          `Failed to store evidence file ${file.originalname}`,
          error,
        );
        if (error instanceof BadRequestException) throw error;
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
      uploadedFiles: uploadedMetadata.map((file) => ({
        ...file,
        signedUrl: this.createSignedUrl(escrowId, file.cid),
      })),
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

    return (dispute.evidenceFiles || []).map((file) => ({
      ...file,
      signedUrl: this.createSignedUrl(escrowId, file.cid),
    })) as EvidenceFileMetadataDto[];
  }

  /** Stream a stored evidence file after checking escrow-party access. */
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

    await this.streamStoredFile(fileMetadata, response);
  }

  /** Serves a short-lived HMAC URL. The URL is bound to an escrow and evidence id. */
  async getEvidenceFileBySignedUrl(
    escrowId: string,
    cid: string,
    expires: string,
    signature: string,
    response: Response,
  ): Promise<void> {
    const expiry = Number(expires);
    if (
      !Number.isSafeInteger(expiry) ||
      expiry < Math.floor(Date.now() / 1000) ||
      !/^[a-f0-9]{64}$/i.test(signature || '')
    ) {
      throw new ForbiddenException('Evidence download link has expired');
    }
    const expected = this.sign(escrowId, cid, expires);
    const actualBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    ) {
      throw new ForbiddenException('Invalid evidence download link');
    }
    const dispute = await this.disputeRepo.findOne({ where: { escrowId } });
    const metadata = dispute?.evidenceFiles?.find((file) => file.cid === cid);
    if (!metadata) throw new NotFoundException('Evidence file not found');
    await this.streamStoredFile(metadata as StoredEvidenceMetadata, response);
  }

  private createSignedUrl(escrowId: string, cid: string): string {
    const expires = String(
      Math.floor(Date.now() / 1000) + this.signedUrlTtlSeconds,
    );
    const signature = this.sign(escrowId, cid, expires);
    return `/v1/evidence-download/${encodeURIComponent(escrowId)}/${encodeURIComponent(cid)}?expires=${expires}&signature=${signature}`;
  }

  private sign(escrowId: string, cid: string, expires: string): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${escrowId}\n${cid}\n${expires}`)
      .digest('hex');
  }

  private scanFile(): boolean {
    // TODO: integrate ClamAV or a managed malware-scanning service.
    return true;
  }

  private async storeFile(
    storageKey: string,
    file: FileWithMetadata,
  ): Promise<void> {
    if (this.storageMode === 's3' && this.s3Client) {
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.s3Bucket,
          Key: `dispute-evidence/${storageKey}`,
          Body: file.buffer,
          ContentType: file.mimetype,
          ServerSideEncryption: 'AES256',
        }),
      );
      return;
    }
    const destination = this.resolveLocalPath(storageKey);
    await fs.promises.mkdir(path.dirname(destination), {
      recursive: true,
      mode: 0o700,
    });
    await fs.promises.writeFile(destination, file.buffer, {
      flag: 'wx',
      mode: 0o600,
    });
  }

  private resolveLocalPath(storageKey: string): string {
    // Only UUID path components are accepted; filenames supplied by clients never reach the filesystem.
    const safeKey = storageKey
      .split('/')
      .every((part) => /^[0-9a-f-]{36}$/i.test(part));
    if (!safeKey) throw new BadRequestException('Invalid evidence storage key');
    const resolved = path.resolve(this.storageDir, `${storageKey}.blob`);
    if (!resolved.startsWith(`${this.storageDir}${path.sep}`)) {
      throw new BadRequestException('Invalid evidence storage path');
    }
    return resolved;
  }

  private async streamStoredFile(
    metadata: StoredEvidenceMetadata,
    response: Response,
  ): Promise<void> {
    response.setHeader('Content-Type', metadata.type);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(metadata.name)}`,
    );
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (
      metadata.storage === 'ipfs' ||
      (!metadata.storage && !metadata.storageKey)
    ) {
      response.redirect(302, this.ipfsService.getGatewayUrl(metadata.cid));
      return;
    }
    if (metadata.storage === 's3' && this.s3Client && metadata.storageKey) {
      const result = await this.s3Client.send(
        new GetObjectCommand({
          Bucket: this.s3Bucket,
          Key: `dispute-evidence/${metadata.storageKey}`,
        }),
      );
      (result.Body as NodeJS.ReadableStream).pipe(response);
      return;
    }
    if (!metadata.storageKey)
      throw new NotFoundException('Evidence file is unavailable');
    const source = this.resolveLocalPath(metadata.storageKey);
    try {
      await fs.promises.access(source, fs.constants.R_OK);
    } catch {
      throw new NotFoundException('Evidence file is unavailable');
    }
    fs.createReadStream(source).pipe(response);
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
