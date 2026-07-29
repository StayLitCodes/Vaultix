import { Module } from '@nestjs/common';
import { GatewaysModule } from '../../gateways/gateways.module';
import { TerminusModule, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Escrow } from '../escrow/entities/escrow.entity';
import { EmailModule } from '../../email/email.module';
import { IpfsModule } from '../ipfs/ipfs.module';

@Module({
  imports: [
    TerminusModule,
    TypeOrmModule.forFeature([User, Escrow]),
    GatewaysModule,
    EmailModule,
    IpfsModule,
  ],
  controllers: [HealthController],
  providers: [TypeOrmHealthIndicator],
})
export class HealthModule {}
