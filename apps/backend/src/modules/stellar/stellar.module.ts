import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import stellarConfig from '../../config/stellar.config';
import { StellarService } from '../../services/stellar.service';
import { EscrowOperationsService } from '../../services/stellar/escrow-operations';
import { SorobanClientService } from '../../services/stellar/soroban-client.service';
import { SorobanBridgeService } from '../../services/stellar/soroban-bridge.service';

@Global()
@Module({
  imports: [ConfigModule.forFeature(stellarConfig)],
  providers: [
    StellarService,
    EscrowOperationsService,
    SorobanClientService,
    SorobanBridgeService,
  ],
  exports: [
    StellarService,
    EscrowOperationsService,
    SorobanClientService,
    SorobanBridgeService,
    ConfigModule.forFeature(stellarConfig),
  ],
})
export class StellarModule {}
