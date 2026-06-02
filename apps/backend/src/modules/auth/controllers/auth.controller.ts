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
} from '@nestjs/common';
import { Request } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthService } from '../services/auth.service';
import {
  ChallengeDto,
  VerifyDto,
  RefreshTokenDto,
  LogoutDto,
  UpdateProfileDto,
} from '../dto/auth.dto';
import { AuthGuard } from '../middleware/auth.guard';
import { AuthThrottlerGuard } from '../middleware/auth-throttler.guard';

@Controller('auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async challenge(@Body() challengeDto: ChallengeDto) {
    return this.authService.generateChallenge(challengeDto.walletAddress);
  }

  @Post('verify')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async verify(@Body() verifyDto: VerifyDto) {
    return this.authService.verifySignature(
      verifyDto.signature,
      verifyDto.publicKey,
    );
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @SkipThrottle()
  async getCurrentUser(@Req() req: Request & { user: { userId: string } }) {
    const user = await this.authService.getCurrentUser(req.user.userId);
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      preferredAsset: user.preferredAsset,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  @SkipThrottle()
  async updateProfile(
    @Req() req: Request & { user: { userId: string } },
    @Body() dto: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(req.user.userId, dto);
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      preferredAsset: user.preferredAsset,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @SkipThrottle()
  async uploadAvatar(
    @Req() req: Request & { user: { userId: string } },
  ) {
    // TODO: Use IpfsService to upload file and get URL
    const mockAvatarUrl = `https://ipfs.io/ipfs/QmT78zSuBmuS4z925WZfrqQ1qHaJ56DQaTfyMUF7F8ff5o`;
    const user = await this.authService.updateAvatarUrl(
      req.user.userId,
      mockAvatarUrl,
    );
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      displayName: user.displayName,
      email: user.email,
      emailVerified: user.emailVerified,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      preferredAsset: user.preferredAsset,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  @Post('profile/verify-email')
  @UseGuards(AuthGuard)
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async sendEmailVerification(
    @Req() req: Request & { user: { userId: string } },
  ) {
    await this.authService.sendEmailVerification(req.user.userId);
    return { message: 'Verification email sent' };
  }

  @Get('profile/verify-email')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async logout(@Body() logoutDto: LogoutDto) {
    await this.authService.logout(logoutDto.refreshToken);
    return { message: 'Successfully logged out' };
  }
}
