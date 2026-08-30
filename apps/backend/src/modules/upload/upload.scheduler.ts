import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UploadService } from './upload.service';

/**
 * Runs a nightly job to remove files on disk that are no longer referenced by
 * any DisputeEvidence row (e.g. after a failed transaction that left a partial
 * write, or files from manually deleted DB rows).
 */
@Injectable()
export class UploadScheduler {
  private readonly logger = new Logger(UploadScheduler.name);

  constructor(private readonly uploadService: UploadService) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanOrphanedFiles(): Promise<void> {
    this.logger.log('Starting orphaned-file cleanup...');
    try {
      const removed = await this.uploadService.cleanOrphanedFiles();
      this.logger.log(`Orphaned-file cleanup finished. Removed: ${removed}`);
    } catch (err) {
      this.logger.error('Orphaned-file cleanup failed', String(err));
    }
  }
}
