import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';

/**
 * Avatar upload limits and validation.
 *
 * The client supplied filename and MIME type are never trusted: the real
 * content is sniffed from the buffer's magic bytes and the payload structure
 * is verified before it is handed to the IPFS storage provider.
 */

/** Documented avatar size limit: 2 MiB. */
export const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024;
export const AVATAR_MAX_SIZE_MB = AVATAR_MAX_SIZE_BYTES / (1024 * 1024);

export const AVATAR_ALLOWED_FORMATS = ['png', 'jpeg', 'gif', 'webp'] as const;
export type AvatarFormat = (typeof AVATAR_ALLOWED_FORMATS)[number];

export const AVATAR_MIME_TYPES: Readonly<Record<AvatarFormat, string>> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

/** Stable, client facing error messages for rejected uploads. */
export const AVATAR_ERROR_MESSAGES = {
  MISSING_FILE: 'avatar file is required',
  EMPTY_FILE: 'avatar file is empty',
  FILE_TOO_LARGE: `avatar file exceeds the ${AVATAR_MAX_SIZE_MB}MB limit`,
  UNSUPPORTED_TYPE: 'avatar must be a PNG, JPEG, GIF or WebP image',
  MALFORMED_FILE: 'avatar file is not a valid image',
  INVALID_REQUEST: 'invalid avatar upload request',
} as const;

export interface AvatarUploadFile {
  buffer?: Buffer | null;
  originalname?: string;
  mimetype?: string;
  size?: number;
}

export interface ValidatedAvatar {
  format: AvatarFormat;
  mimeType: string;
  buffer: Buffer;
  /** Filename derived from the detected format, never from the client input. */
  filename: string;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const GIF87A = 'GIF87a';
const GIF89A = 'GIF89a';

let crcTable: number[] | null = null;

function getCrcTable(): number[] {
  if (!crcTable) {
    crcTable = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      }
      crcTable.push(c >>> 0);
    }
  }
  return crcTable;
}

function crc32(buffer: Buffer): number {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = table[(crc ^ buffer[i]!) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isPng(buffer: Buffer): boolean {
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return false;
  }

  let offset = 8;
  let chunkIndex = 0;
  let sawEnd = false;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const dataStart = offset + 8;

    if (length > buffer.length - dataStart - 4) {
      return false;
    }

    const declaredCrc = buffer.readUInt32BE(dataStart + length);
    if (crc32(buffer.subarray(offset + 4, dataStart + length)) !== declaredCrc) {
      return false;
    }

    if (chunkIndex === 0 && (type !== 'IHDR' || length !== 13)) {
      return false;
    }
    if (type === 'IEND') {
      if (length !== 0) {
        return false;
      }
      sawEnd = true;
    }

    offset = dataStart + length + 4;
    chunkIndex++;
  }

  return sawEnd && offset === buffer.length;
}

function isJpeg(buffer: Buffer): boolean {
  if (
    buffer.length < 4 ||
    buffer[0] !== 0xff ||
    buffer[1] !== 0xd8 ||
    buffer[2] !== 0xff
  ) {
    return false;
  }

  let sawFrameHeader = false;
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return false;
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset++;
    }
    if (offset >= buffer.length) {
      return false;
    }

    const marker = buffer[offset]!;
    offset++;

    if (marker === 0xd9) {
      return sawFrameHeader && offset === buffer.length;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      continue;
    }
    if (offset + 2 > buffer.length) {
      return false;
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return false;
    }

    const isFrameHeader =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrameHeader) {
      if (segmentLength < 8) {
        return false;
      }
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (width === 0 || height === 0) {
        return false;
      }
      sawFrameHeader = true;
    }

    // Entropy coded data follows the scan header; the image must be terminated
    // by an end-of-image marker sitting at the very end of the buffer.
    if (marker === 0xda) {
      return (
        sawFrameHeader &&
        buffer[buffer.length - 2] === 0xff &&
        buffer[buffer.length - 1] === 0xd9
      );
    }

    offset += segmentLength;
  }

  return false;
}

function isGif(buffer: Buffer): boolean {
  if (buffer.length < 14) {
    return false;
  }

  const header = buffer.toString('ascii', 0, 6);
  if (header !== GIF87A && header !== GIF89A) {
    return false;
  }

  const width = buffer.readUInt16LE(6);
  const height = buffer.readUInt16LE(8);
  return width > 0 && height > 0 && buffer[buffer.length - 1] === 0x3b;
}

function isWebp(buffer: Buffer): boolean {
  if (
    buffer.length < 20 ||
    buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    return false;
  }

  const riffSize = buffer.readUInt32LE(4);
  if (riffSize < 4 || riffSize > buffer.length - 8) {
    return false;
  }

  const chunkType = buffer.toString('ascii', 12, 16);
  if (!['VP8 ', 'VP8L', 'VP8X'].includes(chunkType)) {
    return false;
  }

  const chunkSize = buffer.readUInt32LE(16);
  return chunkSize > 0 && chunkSize <= buffer.length - 20;
}

/** Detects the image format from the buffer's magic bytes. */
export function detectAvatarFormat(buffer: Buffer): AvatarFormat | null {
  if (buffer.length === 0) {
    return null;
  }
  if (isPng(buffer)) {
    return 'png';
  }
  if (isJpeg(buffer)) {
    return 'jpeg';
  }
  if (isGif(buffer)) {
    return 'gif';
  }
  if (isWebp(buffer)) {
    return 'webp';
  }
  return null;
}

/** True when the declared MIME type is one of the supported image types. */
export function isAllowedAvatarMimeType(mimetype?: string): boolean {
  if (!mimetype) {
    return false;
  }
  const normalized = mimetype.split(';')[0]!.trim().toLowerCase();
  return Object.values(AVATAR_MIME_TYPES).includes(normalized);
}

/**
 * Validates an uploaded avatar before any storage call is made.
 *
 * Throws a 4xx error for missing, empty, oversized, malformed and unsupported
 * payloads. Returns the normalised payload on success.
 */
export function validateAvatarUpload(
  file: AvatarUploadFile | null | undefined,
): ValidatedAvatar {
  if (!file || !file.buffer) {
    throw new BadRequestException(AVATAR_ERROR_MESSAGES.MISSING_FILE);
  }

  const buffer = file.buffer;

  if (buffer.length === 0) {
    throw new BadRequestException(AVATAR_ERROR_MESSAGES.EMPTY_FILE);
  }

  if (buffer.length > AVATAR_MAX_SIZE_BYTES) {
    throw new PayloadTooLargeException(AVATAR_ERROR_MESSAGES.FILE_TOO_LARGE);
  }

  const hasImageSignature = detectAvatarSignature(buffer) !== null;
  if (!hasImageSignature) {
    throw new BadRequestException(AVATAR_ERROR_MESSAGES.UNSUPPORTED_TYPE);
  }

  const format = detectAvatarFormat(buffer);
  if (!format) {
    throw new BadRequestException(AVATAR_ERROR_MESSAGES.MALFORMED_FILE);
  }

  return {
    format,
    mimeType: AVATAR_MIME_TYPES[format],
    buffer,
    filename: `avatar.${format}`,
  };
}

/** Cheap magic byte check used to tell "not an image" from "broken image". */
function detectAvatarSignature(buffer: Buffer): AvatarFormat | null {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return 'png';
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'jpeg';
  }
  if (buffer.length >= 6) {
    const header = buffer.toString('ascii', 0, 6);
    if (header === GIF87A || header === GIF89A) {
      return 'gif';
    }
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}
