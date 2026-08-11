import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EscrowEvent } from '../modules/escrow/entities/escrow-event.entity';
import { EscrowGateway } from './escrow.gateway';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([EscrowEvent]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret:
          configService.get<string>('JWT_SECRET') ||
          'your-secret-key-change-in-production',
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [EscrowGateway],
  exports: [EscrowGateway],
})
export class EventsModule {}
