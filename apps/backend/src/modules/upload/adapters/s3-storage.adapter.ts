import { Injectable } from '@nestjs/common';
import { Readable } from 'stream';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';

/**
 * S3 storage adapter stub. Wire up with @aws-sdk/client-s3 when S3 is needed.
 * Implement save(), getReadStream(), delete(), and exists() against the S3 bucket
 * configured via AWS_S3_BUCKET / AWS_REGION env vars.
 */
@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  async save(_filename: string, _buffer: Buffer): Promise<string> {
    throw new Error('S3StorageAdapter not yet implemented');
  }

  getReadStream(_storagePath: string): Readable {
    throw new Error('S3StorageAdapter not yet implemented');
  }

  async delete(_storagePath: string): Promise<void> {
    throw new Error('S3StorageAdapter not yet implemented');
  }

  async exists(_storagePath: string): Promise<boolean> {
    throw new Error('S3StorageAdapter not yet implemented');
  }
}
