import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailOutbox } from './entities/email-outbox.entity';
import { EmailService } from './email.service';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([EmailOutbox])],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
