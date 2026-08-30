import { Readable } from 'stream';

export interface StorageAdapter {
  save(filename: string, buffer: Buffer, mimeType: string): Promise<string>;
  getReadStream(storagePath: string): Readable;
  delete(storagePath: string): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
}

export const STORAGE_ADAPTER = 'STORAGE_ADAPTER';
