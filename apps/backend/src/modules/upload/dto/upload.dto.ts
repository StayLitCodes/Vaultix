import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';
import { EvidenceStatus } from '../entities/dispute-evidence.entity';

// ─────────────────────────────────────────────────────────────────────────────
// Response shapes
// ─────────────────────────────────────────────────────────────────────────────

export class EvidenceMetadataDto {
  @ApiProperty({ example: 'a1b2c3d4-...' })
  id: string;

  @ApiProperty({ example: 'dispute-uuid' })
  disputeId: string;

  @ApiProperty({ example: 'user-uuid' })
  uploadedById: string;

  @ApiProperty({ example: 'contract_scan.pdf' })
  originalFilename: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ example: 204800 })
  size: number;

  @ApiPropertyOptional({ example: '/uploads/evidence/.../thumb_uuid.jpg' })
  thumbnailPath: string | null;

  @ApiProperty({ example: 'a3f5...', description: 'SHA-256 hex digest' })
  checksum: string;

  @ApiProperty({ enum: EvidenceStatus })
  scanStatus: EvidenceStatus;

  @ApiProperty()
  createdAt: Date;
}

export class UploadEvidenceResponseDto {
  @ApiProperty()
  disputeId: string;

  @ApiProperty({ type: [EvidenceMetadataDto] })
  uploaded: EvidenceMetadataDto[];

  @ApiProperty({ example: 'Uploaded 2 file(s) successfully' })
  message: string;
}

export class DeleteEvidenceResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Evidence file deleted' })
  message: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Query params
// ─────────────────────────────────────────────────────────────────────────────

export class ListEvidenceQueryDto {
  @ApiPropertyOptional({
    enum: EvidenceStatus,
    description: 'Filter by ClamAV scan status',
  })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(EvidenceStatus))
  scanStatus?: EvidenceStatus;
}
