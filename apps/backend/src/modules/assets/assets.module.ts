import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetsService } from './assets.service';
import { AssetsController } from './assets.controller';
import { AdminAssetsController } from './admin-assets.controller';
import { AllowedAsset } from './entities/allowed-asset.entity';
import { StellarModule } from '../stellar/stellar.module';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AllowedAsset]),
    StellarModule,
    AuthModule,
    UserModule,
  ],
  controllers: [AssetsController, AdminAssetsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
