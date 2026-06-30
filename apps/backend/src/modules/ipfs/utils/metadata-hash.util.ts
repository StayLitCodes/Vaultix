import { createHash } from 'crypto';

/**
 * Computes SHA-256 hash of metadata for tamper-proof verification
 */
export function computeMetadataHash(metadata: Record<string, unknown>): string {
  const canonicalJson = JSON.stringify(metadata, Object.keys(metadata).sort());
  return createHash('sha256').update(canonicalJson).digest('hex');
}

/**
 * Verifies that stored metadata matches the expected hash
 */
export function verifyMetadataHash(
  metadata: Record<string, unknown>,
  expectedHash: string,
): boolean {
  const computedHash = computeMetadataHash(metadata);
  return computedHash === expectedHash;
}
