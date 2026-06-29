import { Injectable, Logger } from '@nestjs/common';
import { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly uploadDir: string;

  constructor() {
    this.uploadDir = path.join(process.cwd(), 'uploads', 'evidence');
    fs.mkdirSync(this.uploadDir, { recursive: true });
  }

  async save(filename: string, buffer: Buffer): Promise<string> {
    const filePath = path.join(this.uploadDir, filename);
    await fs.promises.writeFile(filePath, buffer);
    this.logger.log(`Saved file: ${filePath}`);
    return filePath;
  }

  getReadStream(storagePath: string): Readable {
    return fs.createReadStream(storagePath);
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.promises.unlink(storagePath);
      this.logger.log(`Deleted file: ${storagePath}`);
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw err;
      }
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await fs.promises.access(storagePath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }
}
