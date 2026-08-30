import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';

import { DisputeEvidence } from './entities/dispute-evidence.entity';
import { Dispute } from '../escrow/entities/dispute.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { Party } from '../escrow/entities/party.entity';

import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { UploadScheduler } from './upload.scheduler';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { UploadRateLimitGuard } from './guards/upload-rate-limit.guard';

import { NoOpVirusScanner } from './interfaces/virus-scanner.interface';
import {
  VIRUS_SCANNER_TOKEN,
} from './interfaces/virus-scanner.interface';
import {
  STORAGE_ADAPTER_TOKEN,
} from './interfaces/storage-adapter.interface';

import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([DisputeEvidence, Dispute, Escrow, Party]),
    AuthModule,
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: process.env.NODE_ENV === 'test' ? 1000 : 60,
      },
    ]),
  ],
  controllers: [UploadController],
  providers: [
    UploadService,
    UploadScheduler,
    UploadRateLimitGuard,

    // Local storage adapter — swap for an S3 implementation by changing this provider
    LocalStorageAdapter,
    {
      provide: STORAGE_ADAPTER_TOKEN,
      useExisting: LocalStorageAdapter,
    },

    // No-op virus scanner — replace with a ClamAvScannerService in production
    {
      provide: VIRUS_SCANNER_TOKEN,
      useClass: NoOpVirusScanner,
    },
  ],
  exports: [UploadService],
})
export class UploadModule {}
