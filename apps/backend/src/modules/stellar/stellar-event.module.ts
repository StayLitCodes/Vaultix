import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { StellarEvent } from './entities/stellar-event.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { StellarEventListenerService } from './services/stellar-event-listener.service';
import { StellarEventController } from './controllers/stellar-event.controller';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([StellarEvent, Escrow])],
  controllers: [StellarEventController],
  providers: [StellarEventListenerService],
  exports: [StellarEventListenerService],
})
export class StellarEventModule {}
