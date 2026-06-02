import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';
import { UserService } from './user.service';
import { EmailVerification } from './entities/email-verification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken, EmailVerification])],
  providers: [UserService],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
