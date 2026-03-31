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
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Escrow,
      Party,
      Condition,
      EscrowEvent,
      Dispute,
      User,
    ]),
    AuthModule,
    WebhookModule,
  ],
  controllers: [EscrowController, EscrowSchedulerController, EventsController],
  providers: [
    EscrowService,
    EscrowSchedulerService,
    EscrowStellarIntegrationService,
    EscrowAccessGuard,
    EscrowExpireGuard,
  ],
  exports: [EscrowService, EscrowSchedulerService],
})
export class EscrowModule {}
