import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Webhook } from './webhook.entity';
import { WebhookDelivery } from './entities/webhook-delivery.entity';
import { WebhookService } from '../../services/webhook/webhook.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Webhook, WebhookDelivery]), AuthModule],
  providers: [WebhookService],
  controllers: [WebhookController],
  exports: [WebhookService],
})
export class WebhookModule {}
