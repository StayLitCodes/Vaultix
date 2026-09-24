import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { StellarEvent } from './entities/stellar-event.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { Condition } from '../escrow/entities/condition.entity';
import { EscrowEvent } from '../escrow/entities/escrow-event.entity';
import { Party } from '../escrow/entities/party.entity';
import { StellarEventListenerService } from './services/stellar-event-listener.service';
import { StellarEventController } from './controllers/stellar-event.controller';
import { AdminModule } from '../admin/admin.module';
import { GatewaysModule } from '../../gateways/gateways.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      StellarEvent,
      Escrow,
      Condition,
      EscrowEvent,
      Party,
    ]),
    forwardRef(() => AdminModule),
    forwardRef(() => GatewaysModule),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [StellarEventController],
  providers: [StellarEventListenerService],
  exports: [StellarEventListenerService],
})
export class StellarEventModule {}
