import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Response } from 'express';
import * as crypto from 'crypto';
import * as path from 'path';
import { randomUUID } from 'crypto';

import {
  DisputeEvidence,
  EvidenceStatus,
} from './entities/dispute-evidence.entity';
import { Dispute } from '../escrow/entities/dispute.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { Party } from '../escrow/entities/party.entity';
import {
  detectMimeType,
  ALLOWED_MIME_TYPES,
  IMAGE_MIME_TYPES,
  ALLOWED_EXTENSIONS,
} from './utils/mime-magic.util';
import {
  VIRUS_SCANNER_TOKEN,
  VirusScanner,
} from './interfaces/virus-scanner.interface';
import {
  STORAGE_ADAPTER_TOKEN,
  StorageAdapter,
} from './interfaces/storage-adapter.interface';
import {
  EvidenceMetadataDto,
  ListEvidenceQueryDto,
  UploadEvidenceResponseDto,
  DeleteEvidenceResponseDto,
} from './dto/upload.dto';

/** Max size per file: 10 MB */
const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Max number of evidence files per dispute */
const MAX_FILES_PER_DISPUTE = 10;
/** Thumbnail dimensions (px) */
const THUMB_SIZE = 200;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    @InjectRepository(DisputeEvidence)
    private readonly evidenceRepo: Repository<DisputeEvidence>,

    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,

    @InjectRepository(Escrow)
    private readonly escrowRepo: Repository<Escrow>,

    @InjectRepository(Party)
    private readonly partyRepo: Repository<Party>,

    @Inject(VIRUS_SCANNER_TOKEN)
    private readonly virusScanner: VirusScanner,

    @Inject(STORAGE_ADAPTER_TOKEN)
    private readonly storage: StorageAdapter,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // POST /disputes/:id/evidence
  // ──────────────────────────────────────────────────────────────────────────

  async uploadEvidence(
    disputeId: string,
    files: Express.Multer.File[],
    userId: string,
  ): Promise<UploadEvidenceResponseDto> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided');
    }

    const dispute = await this.findDisputeOrFail(disputeId);
    await this.assertPartyAccess(dispute.escrowId, userId);
    await this.assertFileQuota(disputeId, files.length);

    const uploaded: EvidenceMetadataDto[] = [];

    for (const file of files) {
      const metadata = await this.processSingleFile(file, disputeId, userId);
      uploaded.push(metadata);
    }

    this.logger.log(
      `User ${userId} uploaded ${uploaded.length} file(s) for dispute ${disputeId}`,
    );

    return {
      disputeId,
      uploaded,
      message: `Uploaded ${uploaded.length} file(s) successfully`,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /disputes/:id/evidence
  // ──────────────────────────────────────────────────────────────────────────

  async listEvidence(
    disputeId: string,
    userId: string,
    query: ListEvidenceQueryDto,
  ): Promise<EvidenceMetadataDto[]> {
    const dispute = await this.findDisputeOrFail(disputeId);
    await this.assertPartyAccess(dispute.escrowId, userId);

    const qb = this.evidenceRepo
      .createQueryBuilder('e')
      .where('e.disputeId = :disputeId', { disputeId })
      .andWhere('e.deleted = :deleted', { deleted: false })
      .orderBy('e.createdAt', 'ASC');

    if (query.scanStatus) {
      qb.andWhere('e.scanStatus = :scanStatus', {
        scanStatus: query.scanStatus,
      });
    }

    const records = await qb.getMany();
    return records.map(this.toDto);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // GET /disputes/:id/evidence/:evidenceId/download
  // ──────────────────────────────────────────────────────────────────────────

  async downloadEvidence(
    disputeId: string,
    evidenceId: string,
    userId: string,
    res: Response,
  ): Promise<void> {
    const dispute = await this.findDisputeOrFail(disputeId);
    await this.assertPartyAccess(dispute.escrowId, userId);

    const record = await this.findEvidenceOrFail(disputeId, evidenceId);

    const buffer = await this.storage.read(record.storagePath);

    res.setHeader('Content-Type', record.mimeType);
    res.setHeader('Content-Length', buffer.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(record.originalFilename)}"`,
    );
    res.setHeader('X-Evidence-Checksum', record.checksum);
    res.end(buffer);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /disputes/:id/evidence/:evidenceId  (admin only)
  // ──────────────────────────────────────────────────────────────────────────

  async deleteEvidence(
    disputeId: string,
    evidenceId: string,
    adminUserId: string,
  ): Promise<DeleteEvidenceResponseDto> {
    await this.findDisputeOrFail(disputeId);
    const record = await this.findEvidenceOrFail(disputeId, evidenceId);

    // Soft-delete the DB record
    record.deleted = true;
    record.deletedById = adminUserId;
    record.deletedAt = new Date();
    await this.evidenceRepo.save(record);

    // Attempt to remove physical file (fire-and-forget if it fails)
    this.storage.delete(record.storagePath).catch((err: unknown) => {
      this.logger.warn(
        `Could not delete physical file ${record.storagePath}: ${String(err)}`,
      );
    });

    if (record.thumbnailPath) {
      this.storage.delete(record.thumbnailPath).catch(() => undefined);
    }

    this.logger.log(
      `Admin ${adminUserId} soft-deleted evidence ${evidenceId} for dispute ${disputeId}`,
    );

    return { success: true, message: 'Evidence file deleted' };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Orphan cleanup (called by scheduler)
  // ──────────────────────────────────────────────────────────────────────────

  async cleanOrphanedFiles(): Promise<number> {
    const records = await this.evidenceRepo.find({
      select: ['storagePath', 'thumbnailPath'],
    });

    const activePaths = new Set<string>();
    for (const r of records) {
      activePaths.add(r.storagePath);
      if (r.thumbnailPath) activePaths.add(r.thumbnailPath);
    }

    const deleted = await this.storage.deleteOrphans(activePaths);
    this.logger.log(`Orphan cleanup removed ${deleted} file(s)`);
    return deleted;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  private async processSingleFile(
    file: Express.Multer.File,
    disputeId: string,
    userId: string,
  ): Promise<EvidenceMetadataDto> {
    // 1. Size check
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException(
        `File "${file.originalname}" exceeds the 10 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      );
    }

    // 2. Magic-bytes MIME detection
    const detected = detectMimeType(file.buffer);
    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mimeType)) {
      throw new BadRequestException(
        `File "${file.originalname}" has an unsupported type. ` +
          `Allowed: PNG, JPG, WebP, PDF, TXT, DOCX.`,
      );
    }

    // 3. Virus scan (async, non-blocking after initial check)
    const scanResult = await this.virusScanner.scan(
      file.buffer,
      file.originalname,
    );

    // 4. Build safe UUID filename
    const uuid = randomUUID();
    const storedFilename = `${uuid}.${ALLOWED_EXTENSIONS[detected.mimeType]}`;
    const storagePath = path
      .join('evidence', disputeId, storedFilename)
      .replace(/\\/g, '/');

    // 5. SHA-256 checksum
    const checksum = crypto
      .createHash('sha256')
      .update(file.buffer)
      .digest('hex');

    // 6. Write to storage
    await this.storage.write(storagePath, file.buffer, detected.mimeType);

    // 7. Generate thumbnail for images
    let thumbnailPath: string | null = null;
    if (IMAGE_MIME_TYPES.has(detected.mimeType)) {
      thumbnailPath = await this.generateThumbnail(
        file.buffer,
        disputeId,
        uuid,
      );
    }

    // 8. Persist entity
    const evidence = this.evidenceRepo.create({
      disputeId,
      uploadedById: userId,
      storedFilename,
      originalFilename: file.originalname,
      mimeType: detected.mimeType,
      size: file.size,
      storagePath,
      thumbnailPath,
      checksum,
      scanStatus: scanResult.clean
        ? EvidenceStatus.CLEAN
        : EvidenceStatus.INFECTED,
      scanResult: scanResult.verdict,
      scannedAt: new Date(),
    });

    const saved = await this.evidenceRepo.save(evidence);
    return this.toDto(saved);
  }

  private async generateThumbnail(
    buffer: Buffer,
    disputeId: string,
    uuid: string,
  ): Promise<string | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
      const sharp = require('sharp') as (input: Buffer) => {
        resize(
          w: number,
          h: number,
          opts: Record<string, unknown>,
        ): {
          jpeg(opts: Record<string, unknown>): { toBuffer(): Promise<Buffer> };
        };
      };
      const thumbBuffer = await sharp(buffer)
        .resize(THUMB_SIZE, THUMB_SIZE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({ quality: 80 })
        .toBuffer();

      const thumbFilename = `thumb_${uuid}.jpg`;
      const thumbPath = path
        .join('evidence', disputeId, 'thumbs', thumbFilename)
        .replace(/\\/g, '/');

      await this.storage.write(thumbPath, thumbBuffer, 'image/jpeg');
      return thumbPath;
    } catch (err) {
      this.logger.warn(
        `Thumbnail generation skipped for ${uuid}: ${String(err)}`,
      );
      return null;
    }
  }

  private async findDisputeOrFail(disputeId: string): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({
      where: { id: disputeId },
    });
    if (!dispute) {
      throw new NotFoundException(`Dispute ${disputeId} not found`);
    }
    return dispute;
  }

  private async findEvidenceOrFail(
    disputeId: string,
    evidenceId: string,
  ): Promise<DisputeEvidence> {
    const record = await this.evidenceRepo.findOne({
      where: { id: evidenceId, disputeId, deleted: false },
    });
    if (!record) {
      throw new NotFoundException(`Evidence ${evidenceId} not found`);
    }
    return record;
  }

  /**
   * Verify the user is a party to the escrow that owns this dispute.
   */
  private async assertPartyAccess(
    escrowId: string,
    userId: string,
  ): Promise<void> {
    const party = await this.partyRepo.findOne({
      where: { escrowId, userId },
    });
    if (!party) {
      throw new ForbiddenException(
        'You are not a party to the escrow associated with this dispute',
      );
    }
  }

  /**
   * Ensure adding `incoming` files won't exceed the per-dispute cap.
   */
  private async assertFileQuota(
    disputeId: string,
    incoming: number,
  ): Promise<void> {
    const current = await this.evidenceRepo.count({
      where: { disputeId, deleted: false },
    });
    if (current + incoming > MAX_FILES_PER_DISPUTE) {
      throw new BadRequestException(
        `Dispute already has ${current} file(s). Adding ${incoming} would exceed the ${MAX_FILES_PER_DISPUTE}-file limit.`,
      );
    }
  }

  private toDto(e: DisputeEvidence): EvidenceMetadataDto {
    return {
      id: e.id,
      disputeId: e.disputeId,
      uploadedById: e.uploadedById,
      originalFilename: e.originalFilename,
      mimeType: e.mimeType,
      size: e.size,
      thumbnailPath: e.thumbnailPath,
      checksum: e.checksum,
      scanStatus: e.scanStatus,
      createdAt: e.createdAt,
    };
  }
}
