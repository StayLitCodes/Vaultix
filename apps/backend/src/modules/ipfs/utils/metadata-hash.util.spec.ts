import { computeMetadataHash, verifyMetadataHash } from './metadata-hash.util';

describe('Metadata Hash Utility', () => {
  describe('computeMetadataHash', () => {
    it('should compute consistent hash for same data', () => {
      const metadata = {
        escrowId: 'test-123',
        amount: '100',
        status: 'active',
      };

      const hash1 = computeMetadataHash(metadata);
      const hash2 = computeMetadataHash(metadata);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hash for different data', () => {
      const metadata1 = {
        escrowId: 'test-123',
        amount: '100',
        status: 'active',
      };

      const metadata2 = {
        escrowId: 'test-123',
        amount: '200',
        status: 'active',
      };

      const hash1 = computeMetadataHash(metadata1);
      const hash2 = computeMetadataHash(metadata2);

      expect(hash1).not.toBe(hash2);
    });

    it('should be order-independent (canonical JSON)', () => {
      const metadata1 = {
        escrowId: 'test-123',
        amount: '100',
        status: 'active',
      };

      const metadata2 = {
        status: 'active',
        escrowId: 'test-123',
        amount: '100',
      };

      const hash1 = computeMetadataHash(metadata1);
      const hash2 = computeMetadataHash(metadata2);

      expect(hash1).toBe(hash2);
    });

    it('should handle complex nested objects', () => {
      const metadata = {
        escrowId: 'test-123',
        buyer: 'buyer-1',
        seller: 'seller-1',
        amount: '100.5',
        asset: 'XLM',
        conditions: [
          { description: 'Condition 1', type: 'delivery', fulfilled: false },
          { description: 'Condition 2', type: 'approval', fulfilled: true },
        ],
        deadline: '2026-12-31T23:59:59.000Z',
        status: 'active',
        timestamp: new Date().toISOString(),
        version: 1,
      };

      const hash = computeMetadataHash(metadata);

      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]+$/); // Valid hex string
    });
  });

  describe('verifyMetadataHash', () => {
    it('should return true for matching hash', () => {
      const metadata = {
        escrowId: 'test-123',
        amount: '100',
        status: 'active',
      };

      const hash = computeMetadataHash(metadata);
      const isValid = verifyMetadataHash(metadata, hash);

      expect(isValid).toBe(true);
    });

    it('should return false for mismatched hash', () => {
      const metadata = {
        escrowId: 'test-123',
        amount: '100',
        status: 'active',
      };

      const wrongHash = 'a'.repeat(64);
      const isValid = verifyMetadataHash(metadata, wrongHash);

      expect(isValid).toBe(false);
    });

    it('should detect tampered metadata', () => {
      const originalMetadata = {
        escrowId: 'test-123',
        amount: '100',
        status: 'active',
      };

      const hash = computeMetadataHash(originalMetadata);

      const tamperedMetadata = {
        escrowId: 'test-123',
        amount: '999',
        status: 'active',
      };

      const isValid = verifyMetadataHash(tamperedMetadata, hash);

      expect(isValid).toBe(false);
    });
  });
});
