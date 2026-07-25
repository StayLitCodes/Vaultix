import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class EvidenceFileMetadataDto {
  @IsString()
  @IsNotEmpty()
  cid: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsNumber()
  @IsNotEmpty()
  size: number;

  @IsString()
  @IsNotEmpty()
  uploadedAt: string;

  @IsString()
  @IsNotEmpty()
  uploadedBy: string;
}

export class UploadEvidenceResponseDto {
  @IsString()
  @IsNotEmpty()
  escrowId: string;

  @IsString()
  @IsNotEmpty()
  disputeId: string;

  uploadedFiles: EvidenceFileMetadataDto[];

  @IsString()
  @IsNotEmpty()
  message: string;
}
