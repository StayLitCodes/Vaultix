import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { User } from '../user/entities/user.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { Party } from '../escrow/entities/party.entity';
import { EscrowEvent } from '../escrow/entities/escrow-event.entity';
import { AuthModule } from '../auth/auth.module';
import { EscrowModule } from '../escrow/escrow.module';
import { KycModule } from '../kyc/kyc.module';
import { ConsistencyCheckerService } from './services/consistency-checker.service';
import { AdminEscrowConsistencyController } from './controllers/admin-escrow-consistency.controller';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { AdminAuditLogService } from './services/admin-audit-log.service';
import { AnalyticsService } from './services/analytics.service';
import { AnalyticsController } from './controllers/analytics.controller';
import { Dispute } from '../escrow/entities/dispute.entity';
import { WebhookModule } from '../webhook/webhook.module';
import { AdminWebhookController } from './controllers/admin-webhook.controller';
import { AdminKycController } from './controllers/admin-kyc.controller';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      User,
      Escrow,
      Party,
      EscrowEvent,
      AdminAuditLog,
      Dispute,
    ]),
    EscrowModule,
    KycModule,
    forwardRef(() => WebhookModule),
  ],
  controllers: [
    AdminController,
    AdminEscrowConsistencyController,
    AnalyticsController,
    AdminWebhookController,
    AdminKycController,
  ],
  providers: [
    AdminService,
    ConsistencyCheckerService,
    AdminAuditLogService,
    AnalyticsService,
  ],
  exports: [AdminService, ConsistencyCheckerService, AdminAuditLogService],
})
export class AdminModule {}
