import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entities/user.entity';
import { Escrow } from '../escrow/entities/escrow.entity';

@Module({
  imports: [TerminusModule, TypeOrmModule.forFeature([User, Escrow])],
  controllers: [HealthController],
})
export class HealthModule {}
