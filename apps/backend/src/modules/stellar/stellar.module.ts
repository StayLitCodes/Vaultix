import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import stellarConfig from '../../config/stellar.config';
import { StellarService } from '../../services/stellar.service';
import { EscrowOperationsService } from '../../services/stellar/escrow-operations';
import { SorobanClientService } from '../../services/stellar/soroban-client.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(stellarConfig)],
  providers: [StellarService, EscrowOperationsService, SorobanClientService],
  exports: [
    StellarService,
    EscrowOperationsService,
    SorobanClientService,
    ConfigModule.forFeature(stellarConfig),
  ],
})
export class StellarModule {}
