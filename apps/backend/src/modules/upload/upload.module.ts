import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisputeEvidence } from './entities/dispute-evidence.entity';
import { Dispute } from '../escrow/entities/dispute.entity';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { LocalStorageAdapter } from './adapters/local-storage.adapter';
import { NoopVirusScannerAdapter } from './adapters/noop-virus-scanner.adapter';
import { DisputeAccessGuard } from './guards/dispute-access.guard';
import { UploadRateLimitGuard } from './guards/upload-rate-limit.guard';
import { STORAGE_ADAPTER } from './interfaces/storage-adapter.interface';
import { VIRUS_SCANNER } from './interfaces/virus-scanner.interface';
import { AuthModule } from '../auth/auth.module';
import { EscrowModule } from '../escrow/escrow.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DisputeEvidence, Dispute]),
    AuthModule,
    EscrowModule,
  ],
  controllers: [UploadController],
  providers: [
    UploadService,
    DisputeAccessGuard,
    UploadRateLimitGuard,
    { provide: STORAGE_ADAPTER, useClass: LocalStorageAdapter },
    { provide: VIRUS_SCANNER, useClass: NoopVirusScannerAdapter },
  ],
  exports: [UploadService],
})
export class UploadModule {}
