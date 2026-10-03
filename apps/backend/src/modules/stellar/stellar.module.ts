import { Module, Global, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import stellarConfig from '../../config/stellar.config';
import { StellarService } from '../../services/stellar.service';
import { EscrowOperationsService } from '../../services/stellar/escrow-operations';
import { SorobanClientService } from '../../services/stellar/soroban-client.service';
import { SorobanBridgeService } from '../../services/stellar/soroban-bridge.service';
import { Escrow } from '../escrow/entities/escrow.entity';
import { AdminModule } from '../admin/admin.module';
import { EscrowChainId } from '../escrow/entities/escrow-chain-id.entity';
import { EscrowChainIdService } from '../escrow/services/escrow-chain-id.service';

@Global()
@Module({
  imports: [
    ConfigModule.forFeature(stellarConfig),
    TypeOrmModule.forFeature([Escrow, EscrowChainId]),
    forwardRef(() => AdminModule),
  ],
  providers: [
    StellarService,
    EscrowOperationsService,
    SorobanClientService,
    SorobanBridgeService,
    EscrowChainIdService,
  ],
  exports: [
    StellarService,
    EscrowOperationsService,
    SorobanClientService,
    SorobanBridgeService,
    EscrowChainIdService,
    ConfigModule.forFeature(stellarConfig),
  ],
})
export class StellarModule {}
