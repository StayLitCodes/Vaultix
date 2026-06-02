import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { Escrow } from '../escrow/entities/escrow.entity';
import { User } from '../user/entities/user.entity';
import { Notification } from '../../notifications/entities/notification.entity';

@Module({
  imports: [
    TerminusModule,
    HttpModule,
    TypeOrmModule.forFeature([Escrow, User, Notification]),
  ],
  controllers: [HealthController],
})
export class HealthModule {}
