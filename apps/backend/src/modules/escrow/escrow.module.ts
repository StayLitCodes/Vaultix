import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escrow } from './entities/escrow.entity';
import { Party } from './entities/party.entity';
import { Condition } from './entities/condition.entity';
import { EscrowEvent } from './entities/escrow-event.entity';
import { Dispute } from './entities/dispute.entity';
import { EscrowService } from './services/escrow.service';
import { EscrowSchedulerService } from './services/escrow-scheduler.service';
import { EscrowController } from './controllers/escrow.controller';
import { EscrowSchedulerController } from './controllers/escrow-scheduler.controller';
import { EventsController } from './controllers/events.controller';
import { EscrowAccessGuard } from './guards/escrow-access.guard';
import { EscrowExpireGuard } from './guards/escrow-expire.guard';
import { AuthModule } from '../auth/auth.module';
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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Escrow,
      Party,
      Condition,
      EscrowEvent,
      Dispute,
      User,
      AllowedAsset,
    ]),
    AuthModule,
    WebhookModule,
    IpfsModule,
    NotificationsModule,
  ],
  controllers: [EscrowController, EscrowSchedulerController, EventsController],
  providers: [
    EscrowService,
    EscrowSchedulerService,
    EscrowStellarIntegrationService,
    EscrowAccessGuard,
    EscrowExpireGuard,
    EscrowLifecycleService,
    EscrowFundingService,
    EscrowDisputeService,
    EscrowQueryService,
  ],
  exports: [
    EscrowService,
    EscrowSchedulerService,
    EscrowLifecycleService,
    EscrowFundingService,
    EscrowDisputeService,
    EscrowQueryService,
  ],
})
export class EscrowModule {}
