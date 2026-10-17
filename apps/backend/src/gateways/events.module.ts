import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateJwtSecret } from '../modules/auth/services/jwt-validation.util';
import { Escrow } from '../modules/escrow/entities/escrow.entity';
import { EscrowEvent } from '../modules/escrow/entities/escrow-event.entity';
import { Party } from '../modules/escrow/entities/party.entity';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: validateJwtSecret(config.get<string>('JWT_SECRET')),
      }),
    }),
    TypeOrmModule.forFeature([EscrowEvent, Escrow, Party]),
  ],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
