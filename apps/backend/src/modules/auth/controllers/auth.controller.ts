import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Patch,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import {
  ChallengeDto,
  VerifyDto,
  RefreshTokenDto,
  LogoutDto,
} from '../dto/auth.dto';
import { UpdateProfileDto } from '../dto/profile.dto';
import { AuthGuard } from '../middleware/auth.guard';
import { AuthThrottlerGuard } from '../middleware/auth-throttler.guard';
import { AvatarUploadInterceptor } from '../interceptors/avatar-upload.interceptor';
import type { User, KycStatus } from '../../user/entities/user.entity';

interface ProfileMetadata {
  id: string;
  walletAddress: string;
  isActive: boolean;
  createdAt: Date;
  displayName?: string;
  email?: string;
  emailVerified: boolean;
  avatarUrl?: string;
  bio?: string;
  preferredAsset: string;
  kycStatus: KycStatus;
}

@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private toProfileMetadata(user: User): ProfileMetadata {
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      isActive: user.isActive,
      createdAt: user.createdAt,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      preferredAsset: user.preferredAsset,
      kycStatus: user.kycStatus,
    };
  }

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async challenge(@Body() challengeDto: ChallengeDto) {
    return this.authService.generateChallenge(challengeDto.walletAddress);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async verify(@Body() verifyDto: VerifyDto) {
    return this.authService.verifySignature(
      verifyDto.signature,
      verifyDto.publicKey,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@Req() req: Request & { user: { userId: string } }) {
    const user = await this.authService.getCurrentUser(req.user.userId);
    return this.toProfileMetadata(user);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @Req() req: Request & { user: { userId: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(
      req.user.userId,
      updateProfileDto,
    );
    return this.toProfileMetadata(user);
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(AvatarUploadInterceptor)
  async uploadAvatar(
    @Req() req: Request & { user: { userId: string } },
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const user = await this.authService.uploadAvatar(req.user.userId, file);
    return this.toProfileMetadata(user);
  }

  @Post('profile/verify-email')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async sendEmailVerification(
    @Req() req: Request & { user: { userId: string } },
  ) {
    await this.authService.sendEmailVerification(req.user.userId);
    return { message: 'Verification email sent' };
  }

  @Get('profile/verify-email')
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async logout(@Body() logoutDto: LogoutDto) {
    await this.authService.logout(logoutDto.refreshToken);
    return { message: 'Successfully logged out' };
  }
}
