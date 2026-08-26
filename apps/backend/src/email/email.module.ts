import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailOutbox } from './entities/email-outbox.entity';
import { EmailService } from './email.service';
import { EmailRateLimiterService } from './email-rate-limiter.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailOutbox])],
  providers: [EmailService, EmailRateLimiterService],
  exports: [EmailService, EmailRateLimiterService],
})
export class EmailModule {}
