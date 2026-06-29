export class EvidenceResponseDto {
  id: string;
  disputeId: string;
  uploadedByUserId: string;
  originalName: string;
  mimeType: string;
  size: number;
  hasThumbnail: boolean;
  createdAt: Date;
}

export class EvidenceListResponseDto {
  data: EvidenceResponseDto[];
  total: number;
}
