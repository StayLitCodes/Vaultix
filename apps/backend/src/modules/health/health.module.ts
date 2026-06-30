import { Module } from '@nestjs/common';
import { GatewaysModule } from '../../gateways/gateways.module';
import { TerminusModule, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Escrow } from '../escrow/entities/escrow.entity';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule.forFeature([User, Escrow]),
    GatewaysModule,
  ],
  controllers: [HealthController],
  providers: [TypeOrmHealthIndicator],
})
export class HealthModule {}
