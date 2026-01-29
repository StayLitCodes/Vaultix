import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import stellarConfig from '../../config/stellar.config';
import { StellarService } from '../../services/stellar.service';
import { EscrowOperationsService } from '../../services/stellar/escrow-operations';

@Module({
  imports: [ConfigModule.forFeature(stellarConfig)],
  providers: [StellarService, EscrowOperationsService],
  exports: [
    StellarService,
    EscrowOperationsService,
    ConfigModule.forFeature(stellarConfig),
  ],
})
export class StellarModule {}
