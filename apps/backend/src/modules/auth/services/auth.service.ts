import {
  Injectable,
  Inject,
  forwardRef,
  Logger,
  UnauthorizedException,
  BadRequestException,
  TooManyRequestsException,
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
import { EmailRateLimiterService } from '../../../email/email-rate-limiter.service';
import { PreferenceService } from '../../../notifications/preference.service';
import { NotificationChannel } from '../../../notifications/enums/notification-event.enum';
import { validateJwtSecret } from './jwt-validation.util';

// ---------------------------------------------------------------------------
// Branded HTML wrapper for verification emails
// ---------------------------------------------------------------------------

/**
 * Wraps the given HTML body in the Vaultix branded email shell
 * (header + content + unsubscribe footer).
 */
function wrapVerificationEmail(bodyHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af 0%,#1d4ed8 100%);padding:24px 32px;">
              <h1 style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                🔒 Vaultix
              </h1>
              <p style="margin:4px 0 0;font-size:12px;color:#bfdbfe;">
                Secure Blockchain Escrow
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Unsubscribe footer -->
          <tr>
            <td style="padding:12px 24px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="font-size:12px;color:#9ca3af;margin:0;">
                You received this email because you requested email verification on Vaultix.<br/>
                Log in to your account to manage your notification preferences.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    @InjectRepository(EmailVerification)
    private emailVerificationRepository: Repository<EmailVerification>,
    private ipfsService: IpfsService,
    private emailService: EmailService,
    private emailRateLimiter: EmailRateLimiterService,
    @Inject(forwardRef(() => PreferenceService))
    private preferenceService: PreferenceService,
  ) {}

  async generateChallenge(
    walletAddress: string,
  ): Promise<{ nonce: string; message: string }> {
    this.logger.log({ msg: 'Generating challenge', walletAddress });
    const nonce = crypto.randomBytes(16).toString('hex');
    const message = `Sign this message to authenticate with Vaultix: ${nonce}`;

    let user = await this.userService.findByWalletAddress(walletAddress);

    if (!user) {
      user = await this.userService.create({
        walletAddress,
        nonce,
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
      user = await this.userService.update(user.id, { nonce });
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

    await this.userService.update(user.id, { nonce: undefined });

    const accessToken = this.generateAccessToken(user.id, walletAddress);
    const refreshToken = await this.generateRefreshToken(user.id);

    this.logger.log({
      msg: 'User authenticated successfully',
      userId: user.id,
    });

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

  async updateProfile(
    userId: string,
    updateProfileDto: UpdateProfileDto,
  ): Promise<User> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // If email is being updated, reset emailVerified
    const emailChanged =
      Boolean(updateProfileDto.email) && updateProfileDto.email !== user.email;
    if (emailChanged) {
      updateProfileDto.emailVerified = false;
    }

    const updated = await this.userService.update(userId, updateProfileDto);

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
    file: { buffer: Buffer; originalname: string },
  ): Promise<User> {
    const user = await this.userService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const cid = await this.ipfsService.uploadFile(
      file.buffer,
      file.originalname,
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

    // ── Respect user's notification preferences (email opt-out) ──────────
    try {
      const prefs = await this.preferenceService.getUserPreferences(userId);
      const emailPref = prefs.find(
        (p) => p.channel === NotificationChannel.EMAIL,
      );
      if (emailPref && !emailPref.enabled) {
        this.logger.log(
          `Skipping verification email for user ${userId}: email channel disabled in preferences.`,
        );
        return;
      }
    } catch (error) {
      // Never block the verification flow on preference lookup failure
      this.logger.warn(
        `Could not read notification preferences for user ${userId}: ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // ── Rate limit: max 3 verification emails per hour per user ──────────
    if (!this.emailRateLimiter.tryConsume(userId)) {
      throw new TooManyRequestsException(
        'Too many verification emails requested. Please wait before trying again.',
      );
    }

    // Generate token
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    // Save token
    const emailVerification = this.emailVerificationRepository.create({
      userId,
      token,
      expiresAt,
    });
    await this.emailVerificationRepository.save(emailVerification);

    const verificationUrl = this.buildVerificationUrl(token);

    // ── Queue the verification email (SMTP errors caught, request not crashed) ──
    try {
      await this.emailService.sendEmail(
        user.email,
        'Verify your email address – Vaultix',
        this.buildVerificationEmailHtml(user, verificationUrl),
        this.buildVerificationEmailText(user, verificationUrl),
      );
      this.logger.log(`Verification email queued for user ${userId}`);
    } catch (error) {
      // Log the error but do NOT rethrow — the token is already saved, so the
      // outbox can retry delivery. The HTTP request should still succeed.
      this.logger.error(
        `Failed to queue verification email for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private buildVerificationUrl(token: string): string {
    const baseUrl = this.configService.get<string>(
      'email.verificationBaseUrl',
      'http://localhost:3000/auth/profile/verify-email',
    );
    return `${baseUrl}?token=${encodeURIComponent(token)}`;
  }

  private buildVerificationEmailText(
    user: User,
    verificationUrl: string,
  ): string {
    const name = user.displayName ?? 'there';
    return (
      `Hi ${name},\n\n` +
      `Please verify your email address to finish setting up your Vaultix account.\n\n` +
      `Verify here: ${verificationUrl}\n\n` +
      `This link expires in 24 hours.\n\n` +
      `If you did not request this, you can safely ignore this email.\n\n` +
      `---\n` +
      `Vaultix – Secure Blockchain Escrow\n` +
      `To manage your notification preferences, log in to your account.`
    );
  }

  private buildVerificationEmailHtml(
    user: User,
    verificationUrl: string,
  ): string {
    const greeting = user.displayName ? `Hi ${user.displayName},` : 'Hi there,';
    const bodyHtml =
      `<p style="font-size:15px;line-height:1.6;color:#374151;">${greeting}</p>` +
      `<p style="font-size:15px;line-height:1.6;color:#374151;">` +
      `Please verify your email address to finish setting up your Vaultix account.` +
      `</p>` +
      `<p style="margin:24px 0;">` +
      `<a href="${verificationUrl}"` +
      ` style="display:inline-block;background:#1d4ed8;color:#ffffff;` +
      `padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:600;font-size:15px;">` +
      `Verify email address` +
      `</a>` +
      `</p>` +
      `<p style="font-size:13px;color:#6b7280;">` +
      `Or copy and paste this link into your browser:<br/>` +
      `<a href="${verificationUrl}" style="color:#2563eb;word-break:break-all;">${verificationUrl}</a>` +
      `</p>` +
      `<p style="font-size:13px;color:#9ca3af;margin-top:24px;">` +
      `⏱ This link expires in <strong>24 hours</strong>. ` +
      `If you did not request this, you can safely ignore this email.` +
      `</p>`;

    return wrapVerificationEmail(bodyHtml);
  }

  async verifyEmail(token: string): Promise<void> {
    const verification = await this.emailVerificationRepository.findOne({
      where: { token, isUsed: false },
    });

    if (!verification || verification.expiresAt < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    verification.isUsed = true;
    await this.emailVerificationRepository.save(verification);

    await this.userService.update(verification.userId, { emailVerified: true });
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
