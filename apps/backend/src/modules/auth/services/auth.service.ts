import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { EmailVerification } from '../../user/entities/email-verification.entity';
import { UpdateProfileDto } from '../dto/profile.dto';
import { IpfsService } from '../../ipfs/ipfs.service';
import { EmailService } from '../../../email/email.service';
import { EmailTemplatesService } from '../../../email/email-templates.service';
import { PreferenceService } from '../../../notifications/preference.service';
import { validateJwtSecret } from './jwt-validation.util';
import {
  AvatarUploadFile,
  validateAvatarUpload,
} from '../utils/avatar-upload.util';

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

/** Wallets must sign a challenge within this window (milliseconds). */
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(EmailVerification)
    private emailVerificationRepository: Repository<EmailVerification>,
    private ipfsService: IpfsService,
    private emailService: EmailService,
    private emailTemplatesService: EmailTemplatesService,
    @Inject(forwardRef(() => PreferenceService))
    private preferenceService: PreferenceService,
  ) {}

  async generateChallenge(
    walletAddress: string,
  ): Promise<{ nonce: string; message: string }> {
    this.logger.log({ msg: 'Generating challenge', walletAddress });
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = this.buildChallengeMessage(nonce);
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

    let user = await this.userService.findByWalletAddress(walletAddress);

    if (!user) {
      user = await this.userService.create({
        walletAddress,
        nonce,
        nonceExpiresAt: expiresAt,
      });

      // Seed default notification preferences for the new user. Failures
      // are logged but must not block the signup / challenge flow.
      try {
        await this.preferenceService.seedDefaultPreferences(user.id);
      } catch (error) {
        this.logger.error(
          `Failed to seed default notification preferences for user ${user.id}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    } else {
      // Storing the new nonce and expiry together invalidates any previously
      // issued challenge for this wallet.
      await this.userService.setChallengeNonce(user.id, nonce, expiresAt);
    }

    return { nonce, message };
  }

  async verifySignature(
    signature: string,
    publicKey: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.logger.log({ msg: 'Verifying signature', publicKey });
    // Derive walletAddress from publicKey (trusted source after signature verification)
    const walletAddress = publicKey;

    const user = await this.userService.findByWalletAddress(walletAddress);

    if (!user || !user.nonce) {
      throw new UnauthorizedException(
        'Invalid challenge. Please request a new one.',
      );
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.nonceExpiresAt && user.nonceExpiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException(
        'Challenge expired. Please request a new one.',
      );
    }

    const message = this.buildChallengeMessage(user.nonce);

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

    // Consume the exact challenge atomically. A replayed, superseded or
    // concurrently-submitted challenge loses the conditional update and is
    // rejected, so only one verification can ever succeed.
    const consumed = await this.userService.consumeChallenge(
      user.id,
      user.nonce,
    );
    if (!consumed) {
      throw new UnauthorizedException(
        'Invalid challenge. Please request a new one.',
      );
    }

    const accessToken = this.generateAccessToken(user.id, walletAddress);
    const refreshToken = await this.generateRefreshToken(user.id);

    this.logger.log({
      msg: 'User authenticated successfully',
      userId: user.id,
    });

    return { accessToken, refreshToken };
  }

  /**
   * The supported wallet signing format. Both challenge issuance and
   * verification derive the message from this single helper so the signed
   * payload always matches, and the format stays stable for clients.
   */
  private buildChallengeMessage(nonce: string): string {
    return `Sign this message to authenticate with Vaultix: ${nonce}`;
  }

  /**
   * Rotate a refresh token atomically.
   *
   * The consumed token is deactivated and its successor is issued within a
   * single serialised database transaction so that exactly one concurrent
   * caller wins the race.
   *
   * @returns A new access + refresh token pair.
   * @throws UnauthorizedException  Token is invalid, expired, already used,
   *                                or belongs to an inactive user.
   * @throws ConflictException       Another request already consumed this
   *                                 token (concurrent replay).
   */
  async refreshAccessToken(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Pre-generate successor token material *before* entering the transaction
    // so the crypto work happens outside the critical section.
    const newTokenValue = crypto.randomBytes(32).toString('hex');
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + 7); // 7 days

    try {
      const result = await this.userService.atomicRotateRefreshToken(
        refreshToken,
        newTokenValue,
        newExpiresAt,
      );

      const newAccessToken = this.generateAccessToken(
        result.consumed.user.id,
        result.consumed.user.walletAddress,
      );

      this.logger.log({
        msg: 'Refresh token rotated successfully',
        userId: result.consumed.user.id,
      });

      return { accessToken: newAccessToken, refreshToken: result.newToken };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);

      // Map domain errors to HTTP-layer exceptions without leaking token
      // values into logs.
      if (message === 'REFRESH_TOKEN_ALREADY_CONSUMED') {
        this.logger.warn({ msg: 'Refresh token replay detected' });
        throw new ConflictException(
          'Refresh token has already been used. Please re-authenticate.',
        );
      }
      if (
        message === 'REFRESH_TOKEN_NOT_FOUND' ||
        message === 'REFRESH_TOKEN_EXPIRED'
      ) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      if (message === 'USER_INACTIVE') {
        throw new UnauthorizedException(
          'Account is deactivated. Please contact support.',
        );
      }

      // Unexpected error — re-throw so it surfaces as 500.
      throw error;
    }
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

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // emailVerified is only ever set by verifyEmail, never by the client
    const updateData: Partial<User> = { ...updateProfileDto };
    delete updateData.emailVerified;

    // If email is being updated, reset emailVerified and invalidate any
    // outstanding tokens issued for the previous address
    const emailChanged =
      Boolean(updateProfileDto.email) && updateProfileDto.email !== user.email;
    if (emailChanged) {
      updateData.emailVerified = false;
      await this.emailVerificationRepository.update(
        { userId, isUsed: false },
        { isUsed: true },
      );
    }

    const updated = await this.userService.update(userId, updateData);

    // Automatically send a verification email whenever a new address is set
    if (emailChanged) {
      this.sendEmailVerification(userId).catch((error: unknown) => {
        this.logger.error(
          `Failed to queue verification email for user ${userId}`,
          error instanceof Error ? error.stack : String(error),
        );
      });
    }

    return updated;
  }

  async uploadAvatar(
    userId: string,
    file: AvatarUploadFile | null | undefined,
  ): Promise<User> {
    // Validate the payload before anything leaves the process: rejected uploads
    // must never reach the storage provider.
    const avatar = validateAvatarUpload(file);

    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const cid = await this.ipfsService.uploadFile(
      avatar.buffer,
      avatar.filename,
    );
    const avatarUrl = this.ipfsService.getGatewayUrl(cid);

    return this.userService.update(userId, { avatarUrl });
  }

  async sendEmailVerification(userId: string): Promise<void> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.email) {
      throw new BadRequestException('No email set for user');
    }

    // Generate token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save token
    const emailVerification = this.emailVerificationRepository.create({
      userId,
      email: user.email,
      token,
      expiresAt,
    });
    await this.emailVerificationRepository.save(emailVerification);

    // Queue the verification email for async delivery (retried on failure)
    const verificationUrl = this.buildVerificationUrl(token);
    const rendered = this.emailTemplatesService.renderVerification({
      userName: user.displayName ?? undefined,
      email: user.email,
      verificationUrl,
    });
    await this.emailService.sendEmail(
      user.email,
      rendered.subject,
      rendered.html,
      rendered.text,
    );
    this.logger.log(`Verification email queued for user ${userId}`);
  }

  private buildVerificationUrl(token: string): string {
    const baseUrl = this.configService.get<string>(
      'email.verificationBaseUrl',
      'http://localhost:3000/auth/profile/verify-email',
    );
    return `${baseUrl}?token=${encodeURIComponent(token)}`;
  }

  /**
   * Consume a verification token and mark the user's email verified.
   *
   * The token is only accepted while the user's current email still equals
   * the address it was issued for. Both writes are single conditional
   * UPDATEs whose affected-row count decides the outcome:
   * 1. the token is flipped to used only if it is still unused, so
   *    concurrent requests with the same token have exactly one winner;
   * 2. the winner marks the user verified only if their email still equals
   *    the token's address, so a change racing in between is never verified.
   * Stale, used or expired tokens are rejected without touching the user.
   */
  async verifyEmail(token: string): Promise<void> {
    const invalid = () =>
      new BadRequestException('Invalid or expired verification token');

    const verification = await this.emailVerificationRepository.findOne({
      where: { token },
    });
    if (
      !verification ||
      verification.isUsed ||
      !verification.email ||
      verification.expiresAt < new Date()
    ) {
      throw invalid();
    }

    const user = await this.userService.findById(verification.userId);
    if (!user || user.email !== verification.email) {
      throw invalid();
    }

    const consumed = await this.emailVerificationRepository
      .createQueryBuilder()
      .update(EmailVerification)
      .set({ isUsed: true })
      .where('id = :id AND isUsed = :used', {
        id: verification.id,
        used: false,
      })
      .execute();
    if ((consumed.affected ?? 0) !== 1) {
      throw invalid();
    }

    const marked = await this.userService.markEmailVerified(
      verification.userId,
      verification.email,
    );
    if (!marked) {
      throw invalid();
    }
  }

  async validateToken(
    token: string,
  ): Promise<{ userId: string; walletAddress: string }> {
    try {
      const secret = validateJwtSecret(
        this.configService.get<string>('JWT_SECRET'),
      );
      const payload = (await this.jwtService.verifyAsync(token, {
        secret,
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
