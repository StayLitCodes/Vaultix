/**
 * Storage adapter interface — allows swapping local filesystem for S3 (or any
 * object-store) without changing the service layer.
 *
 * The active adapter is provided via the STORAGE_ADAPTER_TOKEN injection token.
 */

export interface StorageWriteResult {
  /** Relative or absolute path / key under which the file was stored */
  storagePath: string;
  /** Public or signed URL (S3) or a local file path (local adapter) */
  url: string;
}

export const STORAGE_ADAPTER_TOKEN = 'STORAGE_ADAPTER';

export interface StorageAdapter {
  /**
   * Persist `buffer` at the given destination path/key.
   * @param destPath  e.g. "evidence/<disputeId>/<uuid>.pdf"
   * @param buffer    Raw file bytes
   * @param mimeType  Used to set Content-Type on S3 objects
   */
  write(
    destPath: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageWriteResult>;

  /**
   * Return a readable stream or Buffer for the given path/key.
   * Throws NotFoundException if the file does not exist.
   */
  read(storagePath: string): Promise<Buffer>;

  /**
   * Delete the file at the given path/key.
   * Should be a no-op (not throw) if the file is already gone.
   */
  delete(storagePath: string): Promise<void>;

  /**
   * Remove all files that are no longer referenced in the database.
   * Called by the orphan-cleanup scheduled job.
   */
  deleteOrphans(activePaths: Set<string>): Promise<number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// S3 adapter stub — wire up with @aws-sdk/client-s3 when needed
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Placeholder that documents the expected S3 implementation contract.
 * Replace the method bodies with real AWS SDK calls and inject an S3Client.
 *
 * ```ts
 * import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
 * ```
 */
export abstract class S3StorageAdapterBase implements StorageAdapter {
  abstract write(
    destPath: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StorageWriteResult>;
  abstract read(storagePath: string): Promise<Buffer>;
  abstract delete(storagePath: string): Promise<void>;
  abstract deleteOrphans(activePaths: Set<string>): Promise<number>;
}
