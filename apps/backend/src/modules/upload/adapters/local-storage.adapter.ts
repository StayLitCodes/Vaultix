import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import {
  StorageAdapter,
  StorageWriteResult,
} from '../interfaces/storage-adapter.interface';

@Injectable()
export class LocalStorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(LocalStorageAdapter.name);
  private readonly baseDir: string;

  constructor(private readonly config: ConfigService) {
    this.baseDir = config.get<string>(
      'UPLOAD_BASE_DIR',
      path.join(process.cwd(), 'uploads'),
    );
  }

  async write(
    destPath: string,
    buffer: Buffer,
    _mimeType: string,
  ): Promise<StorageWriteResult> {
    const fullPath = path.join(this.baseDir, destPath);
    const dir = path.dirname(fullPath);

    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);

    this.logger.debug(`Wrote ${buffer.length} bytes to ${fullPath}`);
    return { storagePath: destPath, url: fullPath };
  }

  async read(storagePath: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, storagePath);

    try {
      return await fs.promises.readFile(fullPath);
    } catch {
      throw new NotFoundException(
        `File not found on storage: ${storagePath}`,
      );
    }
  }

  async delete(storagePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, storagePath);

    try {
      await fs.promises.unlink(fullPath);
      this.logger.debug(`Deleted file: ${fullPath}`);
    } catch {
      // Already gone — that's fine
      this.logger.warn(`File not found during delete, ignoring: ${fullPath}`);
    }
  }

  /**
   * Walk the upload directory and remove any files whose path is not in
   * `activePaths`. Returns the number of files deleted.
   */
  async deleteOrphans(activePaths: Set<string>): Promise<number> {
    let deleted = 0;

    const walk = async (dir: string): Promise<void> => {
      let entries: fs.Dirent[];

      try {
        entries = await fs.promises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }

      for (const entry of entries) {
        const abs = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(abs);
        } else {
          const rel = path.relative(this.baseDir, abs);
          if (!activePaths.has(rel)) {
            await fs.promises.unlink(abs).catch(() => undefined);
            this.logger.log(`Removed orphaned file: ${rel}`);
            deleted++;
          }
        }
      }
    };

    await walk(this.baseDir);
    return deleted;
  }
}
