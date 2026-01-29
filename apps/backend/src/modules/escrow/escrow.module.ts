import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Escrow } from './entities/escrow.entity';
import { Party } from './entities/party.entity';
import { Condition } from './entities/condition.entity';
import { EscrowEvent } from './entities/escrow-event.entity';
import { EscrowService } from './services/escrow.service';
import { EscrowController } from './controllers/escrow.controller';
import { EscrowAccessGuard } from './guards/escrow-access.guard';
import { AuthModule } from '../auth/auth.module';
import { StellarModule } from '../stellar/stellar.module';
import { EscrowStellarIntegrationService } from './services/escrow-stellar-integration.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Escrow, Party, Condition, EscrowEvent]),
    AuthModule,
    StellarModule,
  ],
  controllers: [EscrowController],
  providers: [
    EscrowService,
    EscrowStellarIntegrationService,
    EscrowAccessGuard,
  ],
  exports: [EscrowService],
})
export class EscrowModule {}
