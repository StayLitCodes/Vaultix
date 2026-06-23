import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthGuard } from './middleware/auth.guard';
import { AdminGuard } from './middleware/admin.guard';
import { UserModule } from '../user/user.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailVerification } from '../user/entities/email-verification.entity';

@Module({
  imports: [
    UserModule,
    IpfsModule,
    TypeOrmModule.forFeature([EmailVerification]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret:
          process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: process.env.NODE_ENV === 'test' ? 1000 : 10,
      },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, AdminGuard],
  exports: [AuthService, AuthGuard, AdminGuard],
})
export class AuthModule {}
