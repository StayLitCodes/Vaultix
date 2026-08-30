/**
 * Server-side MIME validation via magic bytes.
 *
 * We read the first 8 bytes of the file buffer and compare them against known
 * signatures, ignoring whatever the client claims in the Content-Type header.
 *
 * Supported: PNG, JPEG, WebP, GIF, PDF, TXT (heuristic), DOCX/DOC (OLE/ZIP).
 */

export interface MimeDetectionResult {
  mimeType: string;
  extension: string;
}

/** All MIME types accepted for dispute evidence */
export const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
]);

export const ALLOWED_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/msword': 'doc',
};

/** Image MIME types that will have a thumbnail generated */
export const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
]);

/**
 * Detect MIME type from the first bytes of the buffer.
 * Returns null if the signature is not recognised or not in the allow-list.
 */
export function detectMimeType(buffer: Buffer): MimeDetectionResult | null {
  if (buffer.length < 4) return null;

  const b = buffer;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 &&
    b[1] === 0x50 &&
    b[2] === 0x4e &&
    b[3] === 0x47
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  if (
    buffer.length >= 12 &&
    b[0] === 0x52 &&
    b[1] === 0x49 &&
    b[2] === 0x46 &&
    b[3] === 0x46 &&
    b[8] === 0x57 &&
    b[9] === 0x45 &&
    b[10] === 0x42 &&
    b[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  // PDF: 25 50 44 46 (‰PDF)
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return { mimeType: 'application/pdf', extension: 'pdf' };
  }

  // DOCX / XLSX / ZIP family: PK 03 04
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    // We accept all ZIP-based Office files as DOCX for evidence purposes.
    return {
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
    };
  }

  // DOC / OLE2: D0 CF 11 E0 A1 B1 1A E1
  if (
    buffer.length >= 8 &&
    b[0] === 0xd0 &&
    b[1] === 0xcf &&
    b[2] === 0x11 &&
    b[3] === 0xe0 &&
    b[4] === 0xa1 &&
    b[5] === 0xb1 &&
    b[6] === 0x1a &&
    b[7] === 0xe1
  ) {
    return { mimeType: 'application/msword', extension: 'doc' };
  }

  // Plain text heuristic: all bytes in the first 512 are printable ASCII / common UTF-8
  const sample = buffer.slice(0, Math.min(512, buffer.length));
  const isPrintable = sample.every(
    (byte) =>
      (byte >= 0x09 && byte <= 0x0d) || // tab, LF, VT, FF, CR
      (byte >= 0x20 && byte <= 0x7e) || // printable ASCII
      byte >= 0x80, // multibyte UTF-8 continuation / lead bytes
  );
  if (isPrintable) {
    return { mimeType: 'text/plain', extension: 'txt' };
  }

  return null;
}
