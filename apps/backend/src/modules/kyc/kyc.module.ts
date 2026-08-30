import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { KycVerification } from './entities/kyc-verification.entity';
import { User } from '../user/entities/user.entity';
import { KycService } from './services/kyc.service';
import { AmlService } from './services/aml.service';
import { KycController } from './controllers/kyc.controller';
import { KycWebhookController } from './controllers/kyc-webhook.controller';
import { KycGuard } from './guards/kyc.guard';
import { MockKycProvider } from './providers/mock-kyc.provider';
import { MockAmlProvider } from './providers/mock-aml.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([KycVerification, User]),
    ConfigModule,
  ],
  controllers: [KycController, KycWebhookController],
  providers: [
    KycService,
    AmlService,
    KycGuard,
    MockKycProvider,
    MockAmlProvider,
  ],
  exports: [KycService, AmlService, KycGuard],
})
export class KycModule {}
