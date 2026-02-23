import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { EscrowModule } from './modules/escrow/escrow.module';
import { StellarModule } from './modules/stellar/stellar.module';
import { AdminModule } from './modules/admin/admin.module';
import { User } from './modules/user/entities/user.entity';
import { RefreshToken } from './modules/user/entities/refresh-token.entity';
import { Escrow } from './modules/escrow/entities/escrow.entity';
import { Party } from './modules/escrow/entities/party.entity';
import { Condition } from './modules/escrow/entities/condition.entity';
import { EscrowEvent } from './modules/escrow/entities/escrow-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'sqlite',
        database: configService.get<string>(
          'DATABASE_PATH',
          './data/vaultix.db',
        ),
        entities: [User, RefreshToken, Escrow, Party, Condition, EscrowEvent],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    EscrowModule,
    StellarModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
