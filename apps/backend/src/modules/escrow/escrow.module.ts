import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { Escrow } from './entities/escrow.entity';
import { Party } from './entities/party.entity';
import { Condition } from './entities/condition.entity';
import { EscrowEvent } from './entities/escrow-event.entity';
import { EscrowService } from './services/escrow.service';
import { EscrowSchedulerService } from './services/escrow-scheduler.service';
import { EscrowController } from './controllers/escrow.controller';
import { EscrowSchedulerController } from './controllers/escrow-scheduler.controller';
import { EscrowAccessGuard } from './guards/escrow-access.guard';
import { AuthModule } from '../auth/auth.module';
import { StellarModule } from '../stellar/stellar.module';
import { EscrowStellarIntegrationService } from './services/escrow-stellar-integration.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Escrow, Party, Condition, EscrowEvent]),
    AuthModule,
    StellarModule,
  ],
  controllers: [EscrowController, EscrowSchedulerController],
  providers: [
    EscrowService,
    EscrowSchedulerService,
    EscrowStellarIntegrationService,
    EscrowAccessGuard,
  ],
  exports: [EscrowService, EscrowSchedulerService],
})
export class EscrowModule {}
