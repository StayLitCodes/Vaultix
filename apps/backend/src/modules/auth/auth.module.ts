import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { AuthGuard } from './middleware/auth.guard';
import { AdminGuard } from './middleware/admin.guard';
import { SuperAdminGuard } from './middleware/super-admin.guard';
import { UserModule } from '../user/user.module';
import { IpfsModule } from '../ipfs/ipfs.module';
import { EmailModule } from '../../email/email.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailVerification } from '../user/entities/email-verification.entity';
import { NotificationsModule } from '../../notifications/notifications.module';

import { validateJwtSecret } from './services/jwt-validation.util';

@Module({
  imports: [
    UserModule,
    IpfsModule,
    EmailModule,
    forwardRef(() => NotificationsModule),
    TypeOrmModule.forFeature([EmailVerification]),
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: validateJwtSecret(process.env.JWT_SECRET),
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
  providers: [AuthService, AuthGuard, AdminGuard, SuperAdminGuard],
  exports: [AuthService, AuthGuard, AdminGuard, SuperAdminGuard],
})
export class AuthModule {}
