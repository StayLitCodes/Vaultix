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
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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

@Controller('auth')
@ApiTags('auth')
@UseGuards(AuthThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Generate a signed challenge for wallet authentication' })
  @ApiBody({
    type: ChallengeDto,
    description: 'Wallet address used to request a challenge',
    examples: {
      default: {
        summary: 'Example request',
        value: { walletAddress: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF' },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Challenge generated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid wallet address' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many requests' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async challenge(@Body() challengeDto: ChallengeDto) {
    return this.authService.generateChallenge(challengeDto.walletAddress);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: 'Verify a signed challenge and issue tokens' })
  @ApiBody({
    type: VerifyDto,
    description: 'Signature and public key used to verify authentication',
    examples: {
      default: {
        summary: 'Example request',
        value: {
          signature: 'signature',
          publicKey: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF',
        },
      },
    },
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Authentication verified successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid signature payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Signature verification failed' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Too many requests' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async verify(@Body() verifyDto: VerifyDto) {
    return this.authService.verifySignature(
      verifyDto.signature,
      verifyDto.publicKey,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Refresh an access token using a refresh token' })
  @ApiBody({ type: RefreshTokenDto, description: 'Refresh token to exchange' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Tokens refreshed successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid refresh token' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Refresh token expired or invalid' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get the current authenticated user profile' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Current user retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async getCurrentUser(@Req() req: Request & { user: { userId: string } }) {
    const user = await this.authService.getCurrentUser(req.user.userId);
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
    };
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Update the authenticated user profile' })
  @ApiBody({ type: UpdateProfileDto, description: 'Profile fields to update' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Profile updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid profile payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async updateProfile(
    @Req() req: Request & { user: { userId: string } },
    @Body() updateProfileDto: UpdateProfileDto,
  ) {
    const user = await this.authService.updateProfile(
      req.user.userId,
      updateProfileDto,
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
    };
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @UseInterceptors(FileInterceptor('avatar'))
  @ApiOperation({ summary: 'Upload a profile avatar for the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Avatar uploaded successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid avatar upload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async uploadAvatar(
    @Req() req: Request & { user: { userId: string } },
    @UploadedFile() file: { buffer: Buffer; originalname: string },
  ) {
    const user = await this.authService.uploadAvatar(req.user.userId, file);
    return {
      id: user.id,
      avatarUrl: user.avatarUrl,
    };
  }

  @Post('profile/verify-email')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send an email verification message to the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Verification email sent' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async sendEmailVerification(
    @Req() req: Request & { user: { userId: string } },
  ) {
    await this.authService.sendEmailVerification(req.user.userId);
    return { message: 'Verification email sent' };
  }

  @Get('profile/verify-email')
  @ApiOperation({ summary: 'Verify a pending email address using a token' })
  @ApiQuery({ name: 'token', required: true, description: 'Verification token' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Email verified successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid or expired verification token' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async verifyEmail(@Query('token') token: string) {
    await this.authService.verifyEmail(token);
    return { message: 'Email verified successfully' };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('access-token')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Log out an authenticated user and revoke the refresh token' })
  @ApiBody({ type: LogoutDto, description: 'Refresh token to revoke' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Successfully logged out' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid logout payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.INTERNAL_SERVER_ERROR, description: 'Unexpected error' })
  async logout(@Body() logoutDto: LogoutDto) {
    await this.authService.logout(logoutDto.refreshToken);
    return { message: 'Successfully logged out' };
  }
}
