import {
  BadRequestException,
  PayloadTooLargeException,
} from '@nestjs/common';
import {
  AVATAR_ERROR_MESSAGES,
  AVATAR_MAX_SIZE_BYTES,
  detectAvatarFormat,
  isAllowedAvatarMimeType,
  validateAvatarUpload,
} from './avatar-upload.util';
import {
  createGifBuffer,
  createJpegBuffer,
  createMalformedPngBuffer,
  createPngBuffer,
  createTextBuffer,
  createWebpBuffer,
} from '../../../../test/setup/avatar-fixtures';

describe('avatar upload validation', () => {
  describe('detectAvatarFormat', () => {
    it('detects every supported format from its content', () => {
      expect(detectAvatarFormat(createPngBuffer())).toBe('png');
      expect(detectAvatarFormat(createJpegBuffer())).toBe('jpeg');
      expect(detectAvatarFormat(createGifBuffer())).toBe('gif');
      expect(detectAvatarFormat(createWebpBuffer())).toBe('webp');
    });

    it('returns null for non-image and corrupted data', () => {
      expect(detectAvatarFormat(createTextBuffer())).toBeNull();
      expect(detectAvatarFormat(createMalformedPngBuffer())).toBeNull();
      expect(detectAvatarFormat(Buffer.alloc(0))).toBeNull();
    });
  });

  describe('isAllowedAvatarMimeType', () => {
    it('accepts supported image types and rejects everything else', () => {
      expect(isAllowedAvatarMimeType('image/png')).toBe(true);
      expect(isAllowedAvatarMimeType('image/jpeg')).toBe(true);
      expect(isAllowedAvatarMimeType('image/gif')).toBe(true);
      expect(isAllowedAvatarMimeType('image/webp')).toBe(true);
      expect(isAllowedAvatarMimeType('IMAGE/PNG')).toBe(true);
      expect(isAllowedAvatarMimeType('image/svg+xml')).toBe(false);
      expect(isAllowedAvatarMimeType('application/pdf')).toBe(false);
      expect(isAllowedAvatarMimeType(undefined)).toBe(false);
    });
  });

  describe('validateAvatarUpload', () => {
    it('rejects a missing file', () => {
      expect(() => validateAvatarUpload(undefined)).toThrow(
        AVATAR_ERROR_MESSAGES.MISSING_FILE,
      );
      expect(() => validateAvatarUpload(null)).toThrow(BadRequestException);
      expect(() => validateAvatarUpload({})).toThrow(BadRequestException);
    });

    it('rejects an empty file', () => {
      expect(() =>
        validateAvatarUpload({ buffer: Buffer.alloc(0) }),
      ).toThrow(AVATAR_ERROR_MESSAGES.EMPTY_FILE);
    });

    it('rejects a file above the documented size limit', () => {
      const oversized = Buffer.alloc(AVATAR_MAX_SIZE_BYTES + 1, 0x41);
      expect(() => validateAvatarUpload({ buffer: oversized })).toThrow(
        PayloadTooLargeException,
      );
      expect(() => validateAvatarUpload({ buffer: oversized })).toThrow(
        AVATAR_ERROR_MESSAGES.FILE_TOO_LARGE,
      );
    });

    it('rejects a spoofed MIME type by inspecting the real content', () => {
      expect(() =>
        validateAvatarUpload({
          buffer: createTextBuffer(),
          originalname: 'avatar.png',
          mimetype: 'image/png',
        }),
      ).toThrow(AVATAR_ERROR_MESSAGES.UNSUPPORTED_TYPE);
    });

    it('rejects malformed image data that only carries magic bytes', () => {
      expect(() =>
        validateAvatarUpload({
          buffer: createMalformedPngBuffer(),
          originalname: 'avatar.png',
          mimetype: 'image/png',
        }),
      ).toThrow(AVATAR_ERROR_MESSAGES.MALFORMED_FILE);
    });

    it('accepts supported images and normalises the stored filename', () => {
      const buffer = createPngBuffer();
      const result = validateAvatarUpload({
        buffer,
        originalname: '../evil.exe',
        mimetype: 'image/png',
      });

      expect(result.format).toBe('png');
      expect(result.mimeType).toBe('image/png');
      expect(result.filename).toBe('avatar.png');
      expect(result.buffer).toBe(buffer);
    });

    it('accepts every documented supported format', () => {
      expect(validateAvatarUpload({ buffer: createJpegBuffer() }).format).toBe(
        'jpeg',
      );
      expect(validateAvatarUpload({ buffer: createGifBuffer() }).format).toBe(
        'gif',
      );
      expect(validateAvatarUpload({ buffer: createWebpBuffer() }).format).toBe(
        'webp',
      );
    });
  });
});
