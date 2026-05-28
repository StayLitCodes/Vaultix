import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Request } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import {
  ChallengeDto,
  VerifyDto,
  RefreshTokenDto,
  LogoutDto,
} from '../dto/auth.dto';
import { AuthGuard } from '../middleware/auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request authentication challenge',
    description: 'Generates a random challenge string that must be signed by the provided Stellar wallet address.',
  })
  @ApiOkResponse({ description: 'Challenge successfully generated' })
  @ApiBadRequestResponse({ description: 'Invalid wallet address' })
  async challenge(@Body() challengeDto: ChallengeDto) {
    return this.authService.generateChallenge(challengeDto.walletAddress);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verify signed challenge',
    description: 'Verifies the signature of the challenge. Returns an access token and refresh token upon successful verification.',
  })
  @ApiOkResponse({ description: 'Signature verified, tokens returned' })
  @ApiUnauthorizedResponse({ description: 'Invalid signature or challenge expired' })
  @ApiBadRequestResponse({ description: 'Invalid request parameters' })
  async verify(@Body() verifyDto: VerifyDto) {
    return this.authService.verifySignature(
      verifyDto.walletAddress,
      verifyDto.signature,
      verifyDto.publicKey,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Refresh access token',
    description: 'Provides a new access token using a valid refresh token.',
  })
  @ApiOkResponse({ description: 'New access token generated' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get current user profile',
    description: 'Returns the profile details of the currently authenticated user.',
  })
  @ApiOkResponse({ description: 'User profile retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized, invalid access token' })
  async getCurrentUser(@Req() req: Request & { user: { userId: string } }) {
    const user = await this.authService.getCurrentUser(req.user.userId);
    return {
      id: user.id,
      walletAddress: user.walletAddress,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  @Post('logout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Logout user',
    description: 'Invalidates the current session and refresh token.',
  })
  @ApiOkResponse({ description: 'Successfully logged out' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async logout(@Body() logoutDto: LogoutDto) {
    await this.authService.logout(logoutDto.refreshToken);
    return { message: 'Successfully logged out' };
  }
}
