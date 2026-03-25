import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Param,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Request } from 'express';
import { ThrottlerGuard } from '@nestjs/throttler';
import { StrKey } from '@stellar/stellar-sdk';
import { AuthService } from '../services/auth.service';
import { UserService } from '../../user/user.service';
import {
  ChallengeDto,
  VerifyDto,
  RefreshTokenDto,
  LogoutDto,
} from '../dto/auth.dto';
import { AuthGuard } from '../middleware/auth.guard';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {}

  /**
   * Resolve a Vaultix user id by Stellar wallet address (counterparty must have signed in once).
   */
  @Get('wallet/:address')
  @UseGuards(AuthGuard)
  async getUserByWallet(@Param('address') address: string) {
    if (!StrKey.isValidEd25519PublicKey(address)) {
      throw new BadRequestException('Invalid Stellar address');
    }
    const user = await this.userService.findByWalletAddress(address);
    if (!user) {
      throw new NotFoundException(
        'No Vaultix account exists for this wallet address',
      );
    }
    return { id: user.id, walletAddress: user.walletAddress };
  }

  @Post('challenge')
  @HttpCode(HttpStatus.OK)
  async challenge(@Body() challengeDto: ChallengeDto) {
    return this.authService.generateChallenge(challengeDto.walletAddress);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(@Body() verifyDto: VerifyDto) {
    return this.authService.verifySignature(
      verifyDto.walletAddress,
      verifyDto.signature,
      verifyDto.publicKey,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    return this.authService.refreshAccessToken(refreshTokenDto.refreshToken);
  }

  @Get('me')
  @UseGuards(AuthGuard)
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
  async logout(@Body() logoutDto: LogoutDto) {
    await this.authService.logout(logoutDto.refreshToken);
    return { message: 'Successfully logged out' };
  }
}
