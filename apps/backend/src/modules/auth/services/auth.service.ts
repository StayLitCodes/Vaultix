import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';

// Stellar SDK types for signature verification
interface StellarKeypair {
  verify(data: Buffer, signature: Buffer): boolean;
}

interface StellarSdkModule {
  Keypair: {
    fromPublicKey(publicKey: string): StellarKeypair;
  };
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const StellarSdk: StellarSdkModule = require('stellar-sdk') as StellarSdkModule;

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async generateChallenge(
    walletAddress: string,
  ): Promise<{ nonce: string; message: string }> {
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `Sign this message to authenticate with Vaultix: ${nonce}`;

    let user = await this.userService.findByWalletAddress(walletAddress);

    if (!user) {
      user = await this.userService.create({
        walletAddress,
        nonce,
      });
    } else {
      user = await this.userService.update(user.id, { nonce });
    }

    return { nonce, message };
  }

  async verifySignature(
    walletAddress: string,
    signature: string,
    publicKey: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const user = await this.userService.findByWalletAddress(walletAddress);

    if (!user || !user.nonce) {
      throw new UnauthorizedException(
        'Invalid challenge. Please request a new one.',
      );
    }

    const message = `Sign this message to authenticate with Vaultix: ${user.nonce}`;

    try {
      const verifier = StellarSdk.Keypair.fromPublicKey(publicKey);
      const signatureBuffer = Buffer.from(signature, 'hex');
      const messageBuffer = Buffer.from(message);
      const isValid = verifier.verify(messageBuffer, signatureBuffer);

      if (!isValid) {
        throw new UnauthorizedException('Invalid signature');
      }
    } catch {
      throw new UnauthorizedException('Signature verification failed');
    }

    if (publicKey !== walletAddress) {
      throw new UnauthorizedException(
        'Public key does not match wallet address',
      );
    }

    await this.userService.update(user.id, { nonce: undefined });

    const accessToken = this.generateAccessToken(user.id, walletAddress);
    const refreshToken = await this.generateRefreshToken(user.id);

    return { accessToken, refreshToken };
  }

  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const token = await this.userService.findRefreshToken(refreshToken);

    if (!token || token.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.userService.invalidateRefreshToken(refreshToken);

    const newAccessToken = this.generateAccessToken(
      token.user.id,
      token.user.walletAddress,
    );
    const newRefreshToken = await this.generateRefreshToken(token.user.id);

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.userService.invalidateRefreshToken(refreshToken);
  }

  async getCurrentUser(userId: string): Promise<User> {
    const user = await this.userService.findById(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  async validateToken(
    token: string,
  ): Promise<{ userId: string; walletAddress: string }> {
    try {
      const payload = (await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      })) as unknown as { sub: string; walletAddress: string; type: string };

      if (payload.type !== 'access') {
        throw new UnauthorizedException('Invalid token type');
      }

      return {
        userId: payload.sub,
        walletAddress: payload.walletAddress,
      };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private generateAccessToken(userId: string, walletAddress: string): string {
    const payload = {
      sub: userId,
      walletAddress,
      type: 'access',
    };

    return this.jwtService.sign(payload);
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.userService.createRefreshToken({
      token,
      userId,
      expiresAt,
    });

    return token;
  }
}
