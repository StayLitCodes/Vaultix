import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import { DisputeEvidence } from './entities/dispute-evidence.entity';
import { Dispute } from '../escrow/entities/dispute.entity';
import { EscrowService } from '../escrow/services/escrow.service';
import {
  StorageAdapter,
  STORAGE_ADAPTER,
} from './interfaces/storage-adapter.interface';
import {
  VirusScanner,
  VIRUS_SCANNER,
} from './interfaces/virus-scanner.interface';
import {
  EvidenceListResponseDto,
  EvidenceResponseDto,
} from './dto/evidence-response.dto';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_FILES_PER_DISPUTE = 10;
const THUMBNAIL_SIZE = 200;

function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length < 4) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }

  // WebP: RIFF????WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp';
  }

  // PDF: %PDF
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // DOCX / ZIP: PK\x03\x04
  if (
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  ) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }

  // TXT: validate as printable ASCII / UTF-8 (heuristic: no null bytes in first 512)
  const sample = buffer.slice(0, Math.min(512, buffer.length));
  if (!sample.includes(0x00)) {
    return 'text/plain';
  }

  return null;
}

function toResponseDto(ev: DisputeEvidence): EvidenceResponseDto {
  return {
    id: ev.id,
    disputeId: ev.disputeId,
    uploadedByUserId: ev.uploadedByUserId,
    originalName: ev.originalName,
    mimeType: ev.mimeType,
    size: ev.size,
    hasThumbnail: ev.thumbnailPath !== null,
    createdAt: ev.createdAt,
  };
}

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads', 'thumbnails');

  constructor(
    @InjectRepository(DisputeEvidence)
    private readonly evidenceRepo: Repository<DisputeEvidence>,
    @InjectRepository(Dispute)
    private readonly disputeRepo: Repository<Dispute>,
    @Inject(STORAGE_ADAPTER)
    private readonly storage: StorageAdapter,
    @Inject(VIRUS_SCANNER)
    private readonly virusScanner: VirusScanner,
    private readonly escrowService: EscrowService,
  ) {
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async uploadEvidence(
    disputeId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<EvidenceResponseDto> {
    const dispute = await this.getDisputeOrThrow(disputeId);

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File exceeds maximum size of 10 MB');
    }

    const detectedMime = detectMimeType(file.buffer);
    if (!detectedMime || !ALLOWED_MIME_TYPES.has(detectedMime)) {
      throw new UnprocessableEntityException(
        'Unsupported file type. Allowed: PNG, JPG, WebP, PDF, TXT, DOCX',
      );
    }

    const activeCount = await this.evidenceRepo.count({
      where: { disputeId, isDeleted: false },
    });
    if (activeCount >= MAX_FILES_PER_DISPUTE) {
      throw new BadRequestException(
        `Maximum of ${MAX_FILES_PER_DISPUTE} evidence files per dispute`,
      );
    }

    const scanResult = await this.virusScanner.scan(file.buffer, file.originalname);
    if (!scanResult.clean) {
      throw new UnprocessableEntityException(
        `File rejected by virus scanner: ${scanResult.threat ?? 'unknown threat'}`,
      );
    }

    const ext = this.extensionForMime(detectedMime);
    const uuid = randomUUID();
    const filename = `${uuid}${ext}`;

    const storagePath = await this.storage.save(filename, file.buffer, detectedMime);

    let thumbnailPath: string | null = null;
    if (IMAGE_MIME_TYPES.has(detectedMime)) {
      thumbnailPath = await this.generateThumbnail(
        file.buffer,
        uuid,
        detectedMime,
      );
    }

    const evidence = this.evidenceRepo.create({
      disputeId: dispute.id,
      uploadedByUserId: userId,
      filename,
      originalName: file.originalname,
      mimeType: detectedMime,
      size: file.size,
      storagePath,
      thumbnailPath,
    });

    const saved = await this.evidenceRepo.save(evidence);
    this.logger.log(`Evidence ${saved.id} uploaded for dispute ${disputeId}`);
    return toResponseDto(saved);
  }

  async listEvidence(
    disputeId: string,
  ): Promise<EvidenceListResponseDto> {
    await this.getDisputeOrThrow(disputeId);

    const [records, total] = await this.evidenceRepo.findAndCount({
      where: { disputeId, isDeleted: false },
      order: { createdAt: 'ASC' },
    });

    return { data: records.map(toResponseDto), total };
  }

  async downloadEvidence(
    disputeId: string,
    evidenceId: string,
  ): Promise<{ stream: ReturnType<StorageAdapter['getReadStream']>; evidence: DisputeEvidence }> {
    await this.getDisputeOrThrow(disputeId);

    const evidence = await this.evidenceRepo.findOne({
      where: { id: evidenceId, disputeId, isDeleted: false },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    const fileExists = await this.storage.exists(evidence.storagePath);
    if (!fileExists) {
      throw new NotFoundException('Evidence file missing from storage');
    }

    const stream = this.storage.getReadStream(evidence.storagePath);
    return { stream, evidence };
  }

  async deleteEvidence(
    disputeId: string,
    evidenceId: string,
    adminUserId: string,
  ): Promise<void> {
    await this.getDisputeOrThrow(disputeId);

    const isAdmin = await this.escrowService.isUserAdmin(adminUserId);
    if (!isAdmin) {
      throw new ForbiddenException('Only admins can delete evidence');
    }

    const evidence = await this.evidenceRepo.findOne({
      where: { id: evidenceId, disputeId, isDeleted: false },
    });

    if (!evidence) {
      throw new NotFoundException('Evidence not found');
    }

    evidence.isDeleted = true;
    evidence.deletedByUserId = adminUserId;
    evidence.deletedAt = new Date();
    await this.evidenceRepo.save(evidence);

    await this.storage.delete(evidence.storagePath).catch((err: unknown) =>
      this.logger.warn(`Could not delete file ${evidence.storagePath}: ${String(err)}`),
    );

    if (evidence.thumbnailPath) {
      await this.storage.delete(evidence.thumbnailPath).catch((err: unknown) =>
        this.logger.warn(`Could not delete thumbnail ${evidence.thumbnailPath}: ${String(err)}`),
      );
    }

    this.logger.log(`Evidence ${evidenceId} soft-deleted by admin ${adminUserId}`);
  }

  async cleanOrphanedFiles(): Promise<number> {
    const allEvidence = await this.evidenceRepo.find();
    let cleaned = 0;

    for (const ev of allEvidence) {
      if (ev.isDeleted) {
        const exists = await this.storage.exists(ev.storagePath);
        if (exists) {
          await this.storage.delete(ev.storagePath).catch(() => undefined);
          cleaned++;
        }
      }
    }

    this.logger.log(`Cleaned ${cleaned} orphaned files`);
    return cleaned;
  }

  private async getDisputeOrThrow(disputeId: string): Promise<Dispute> {
    const dispute = await this.disputeRepo.findOne({ where: { id: disputeId } });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }
    return dispute;
  }

  private extensionForMime(mime: string): string {
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
      'text/plain': '.txt',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        '.docx',
    };
    return map[mime] ?? '';
  }

  private async generateThumbnail(
    buffer: Buffer,
    uuid: string,
    _mimeType: string,
  ): Promise<string | null> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const sharp = require('sharp') as typeof import('sharp');
      const thumbFilename = `${uuid}_thumb.jpg`;
      const thumbPath = path.join(this.uploadDir, thumbFilename);

      await sharp(buffer)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toFile(thumbPath);

      return thumbPath;
    } catch (err: unknown) {
      this.logger.warn(
        `Thumbnail generation skipped (sharp not available?): ${String(err)}`,
      );
      return null;
    }
  }
}
