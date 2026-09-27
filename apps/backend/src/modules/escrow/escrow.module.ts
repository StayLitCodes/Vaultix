import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escrow } from './entities/escrow.entity';
import { EscrowCreationIntent } from './entities/escrow-creation-intent.entity';
import { Party } from './entities/party.entity';
import { Condition } from './entities/condition.entity';
import { EscrowEvent } from './entities/escrow-event.entity';
import { Dispute } from './entities/dispute.entity';
import { EscrowService } from './services/escrow.service';
import { EscrowCreationService } from './services/escrow-creation.service';
import { EscrowSchedulerService } from './services/escrow-scheduler.service';
import { EscrowController } from './controllers/escrow.controller';
import { EscrowSchedulerController } from './controllers/escrow-scheduler.controller';
import { EventsController } from './controllers/events.controller';
import { EscrowAccessGuard } from './guards/escrow-access.guard';
import { EscrowExpireGuard } from './guards/escrow-expire.guard';
import { AuthModule } from '../auth/auth.module';
import { KycModule } from '../kyc/kyc.module';
import { EscrowStellarIntegrationService } from './services/escrow-stellar-integration.service';
import { WebhookModule } from '../webhook/webhook.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { User } from '../user/entities/user.entity';
import { AllowedAsset } from '../assets/entities/allowed-asset.entity';
import { EscrowLifecycleService } from './escrow-lifecycle.service';
import { EscrowFundingService } from './escrow-funding.service';
import { EscrowDisputeService } from './escrow-dispute.service';
import { EscrowQueryService } from './escrow-query.service';
import { EscrowEvidenceService } from './services/escrow-evidence.service';
import { EscrowIpfsSyncService } from './services/escrow-ipfs-sync.service';
import { EscrowExpirySchedulerService } from './services/escrow-expiry-scheduler.service';
import { AdminModule } from '../admin/admin.module';
import { forwardRef } from '@nestjs/common';
import { EscrowChainId } from './entities/escrow-chain-id.entity';
import { EscrowChainIdService } from './services/escrow-chain-id.service';
import { SorobanTxIntent } from './entities/soroban-tx-intent.entity';
import { SorobanIntentService } from './services/soroban-intent.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Escrow,
      EscrowCreationIntent,
      Party,
      Condition,
      EscrowEvent,
      Dispute,
      User,
      AllowedAsset,
      EscrowChainId,
      SorobanTxIntent,
    ]),
    AuthModule,
    KycModule,
    WebhookModule,
    IpfsModule,
    NotificationsModule,
    forwardRef(() => AdminModule),
  ],
  controllers: [EscrowController, EscrowSchedulerController, EventsController],
  providers: [
    EscrowService,
    EscrowCreationService,
    EscrowSchedulerService,
    EscrowStellarIntegrationService,
    EscrowAccessGuard,
    EscrowExpireGuard,
    EscrowLifecycleService,
    EscrowFundingService,
    EscrowDisputeService,
    EscrowQueryService,
    EscrowEvidenceService,
    EscrowIpfsSyncService,
    EscrowExpirySchedulerService,
    EscrowChainIdService,
    SorobanIntentService,
  ],
  exports: [
    EscrowService,
    EscrowSchedulerService,
    EscrowLifecycleService,
    EscrowFundingService,
    EscrowDisputeService,
    EscrowQueryService,
    EscrowEvidenceService,
    EscrowIpfsSyncService,
    EscrowExpirySchedulerService,
    EscrowChainIdService,
    SorobanIntentService,
  ],
})
export class EscrowModule {}
