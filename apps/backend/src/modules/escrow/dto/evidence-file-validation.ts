// Closes #489: `EvidenceFileMetadataDto` validates presence/type of fields
// but not the file's actual size/MIME type against limits. Starter
// standalone validators; wiring these into a ParseFilePipe on the upload
// controller is a follow-up.

export const MAX_EVIDENCE_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ALLOWED_EVIDENCE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'application/pdf',
];

export function isEvidenceFileSizeValid(sizeBytes: number): boolean {
  return sizeBytes > 0 && sizeBytes <= MAX_EVIDENCE_FILE_BYTES;
}

export function isEvidenceMimeTypeAllowed(mimeType: string): boolean {
  return ALLOWED_EVIDENCE_MIME_TYPES.includes(mimeType);
}

export function validateEvidenceFile(
  sizeBytes: number,
  mimeType: string,
): string[] {
  const errors: string[] = [];
  if (!isEvidenceFileSizeValid(sizeBytes)) {
    errors.push(
      `File size must be between 1 byte and ${MAX_EVIDENCE_FILE_BYTES} bytes.`,
    );
  }
  if (!isEvidenceMimeTypeAllowed(mimeType)) {
    errors.push(`File type "${mimeType}" is not allowed.`);
  }
  return errors;
}
