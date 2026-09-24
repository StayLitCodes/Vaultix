import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  KycVerification,
  KycProvider,
  KycStatus,
} from '../entities/kyc-verification.entity';
import { User } from '../../user/entities/user.entity';
import { IKycProvider } from '../interfaces/kyc-provider.interface';
import { InitiateKycDto } from '../dto/kyc.dto';
import { MockKycProvider } from '../providers/mock-kyc.provider';

/**
 * Service responsible for KYC verification orchestration.
 *
 * Uses the strategy pattern to delegate to a pluggable KYC provider.
 * The provider is selected based on environment configuration or
 * per-request preference.
 *
 * Supported providers are registered via the KYC_PROVIDERS injection token.
 * Defaults to the MockKycProvider in development.
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  /** Map of provider name -> provider instance */
  private readonly providers = new Map<string, IKycProvider>();

  /** Provider to use when none is specified */
  private readonly defaultProviderName: string;

  constructor(
    @InjectRepository(KycVerification)
    private readonly kycVerificationRepository: Repository<KycVerification>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly mockProvider: MockKycProvider,
  ) {
    // Register providers — add real providers here as they're integrated
    this.providers.set('mock', mockProvider);

    this.defaultProviderName =
      this.configService.get<string>('KYC_DEFAULT_PROVIDER') || 'mock';
  }

  /**
   * Get the KYC provider implementation.
   */
  getProvider(name?: string): IKycProvider {
    const providerName = name || this.defaultProviderName;
    const provider = this.providers.get(providerName);

    if (!provider) {
      throw new BadRequestException(
        `KYC provider "${providerName}" is not configured`,
      );
    }

    return provider;
  }

  /**
   * Initiate a KYC verification for a user.
   * Creates a KycVerification record and returns a redirect URL.
   */
  async initiateVerification(
    userId: string,
    dto: InitiateKycDto,
  ): Promise<{
    verificationId: string;
    redirectUrl: string;
    expiresAt?: Date;
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.kycStatus === KycStatus.VERIFIED) {
      throw new BadRequestException('User is already KYC verified');
    }

    // Check for existing pending verification
    const existingPending = await this.kycVerificationRepository.findOne({
      where: { userId, status: KycStatus.PENDING },
      order: { createdAt: 'DESC' },
    });

    if (existingPending) {
      this.logger.log(
        `User ${userId} has an existing pending verification: ${existingPending.id}`,
      );
      return {
        verificationId: existingPending.providerVerificationId || '',
        redirectUrl: `/v1/kyc/mock-verify?id=${existingPending.id}`,
        expiresAt: existingPending.expiresAt,
      };
    }

    const providerName = dto.provider || KycProvider.MOCK;
    const provider = this.getProvider(providerName);

    const result = await provider.initiateVerification(
      userId,
      dto.redirectPath,
    );

    const verification = this.kycVerificationRepository.create({
      userId,
      provider: providerName as KycProvider,
      providerVerificationId: result.verificationId,
      status: KycStatus.PENDING,
      initiatedAt: new Date(),
      expiresAt: result.expiresAt || undefined,
    });

    await this.kycVerificationRepository.save(verification);

    // Update the user's KYC status
    user.kycStatus = KycStatus.PENDING;
    await this.userRepository.save(user);

    this.logger.log(
      `KYC verification initiated for user ${userId}: ${verification.id}`,
    );

    return {
      verificationId: result.verificationId,
      redirectUrl: result.redirectUrl,
      expiresAt: result.expiresAt,
    };
  }

  /**
   * Get the current KYC status for a user.
   */
  async getKycStatus(userId: string): Promise<{
    status: KycStatus;
    provider?: string;
    initiatedAt?: Date;
    completedAt?: Date;
    rejectionReason?: string;
    verifications?: KycVerification[];
  }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const latestVerification = await this.kycVerificationRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    return {
      status: user.kycStatus,
      provider: latestVerification?.provider,
      initiatedAt: latestVerification?.initiatedAt,
      completedAt: latestVerification?.completedAt,
      rejectionReason: latestVerification?.rejectionReason,
    };
  }

  /**
   * Process a webhook callback from a KYC provider.
   *
   * This method:
   * 1. Validates the webhook signature
   * 2. Processes the payload through the appropriate provider
   * 3. Updates the KycVerification record
   * 4. Updates the user's kycStatus
   */
  async processWebhook(
    provider: string,
    payload: unknown,
    signature: string,
  ): Promise<void> {
    const kycProvider = this.getProvider(provider);

    // Validate webhook signature
    if (!kycProvider.validateWebhook(payload, signature)) {
      this.logger.warn(`Invalid webhook signature for provider ${provider}`);
      throw new BadRequestException('Invalid webhook signature');
    }

    // Process through provider
    const result = await kycProvider.processWebhook(payload);

    // Find the verification record
    const verification = await this.kycVerificationRepository.findOne({
      where: { providerVerificationId: result.verificationId },
    });

    if (!verification) {
      this.logger.warn(
        `No verification found for ID: ${result.verificationId}`,
      );
      throw new NotFoundException(
        `Verification ${result.verificationId} not found`,
      );
    }

    // Update verification record
    verification.status = result.status;
    if (result.rejectionReason) {
      verification.rejectionReason = result.rejectionReason;
    }
    if (result.metadata) {
      verification.providerMetadata = result.metadata;
    }

    if (
      result.status === KycStatus.VERIFIED ||
      result.status === KycStatus.REJECTED
    ) {
      verification.completedAt = new Date();
    }

    await this.kycVerificationRepository.save(verification);

    // Update user's KYC status
    const user = await this.userRepository.findOne({
      where: { id: result.userId },
    });

    if (user) {
      user.kycStatus = result.status;
      await this.userRepository.save(user);

      this.logger.log(
        `User ${result.userId} KYC status updated to ${result.status}`,
      );
    }
  }

  /**
   * Admin override: manually update a user's KYC status.
   */
  async adminUpdateKycStatus(
    userId: string,
    status: KycStatus,
    reason?: string,
  ): Promise<{ user: User; oldStatus: string }> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldStatus = user.kycStatus;
    user.kycStatus = status;

    if (status === KycStatus.VERIFIED) {
      user.kycVerifiedAt = new Date();
    }

    await this.userRepository.save(user);

    // Also update the latest verification record
    const verification = await this.kycVerificationRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    if (verification) {
      verification.status = status;
      if (reason) {
        verification.rejectionReason = reason;
      }
      if (
        status === KycStatus.VERIFIED ||
        status === KycStatus.REJECTED
      ) {
        verification.completedAt = new Date();
      }
      await this.kycVerificationRepository.save(verification);
    }

    this.logger.log(
      `Admin updated KYC status for user ${userId}: ${oldStatus} -> ${status}`,
    );

    return { user, oldStatus };
  }

  /**
   * Check if a user is KYC verified.
   */
  async isKycVerified(userId: string): Promise<boolean> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'kycStatus'],
    });

    return user?.kycStatus === KycStatus.VERIFIED;
  }

  /**
   * Get all users with their KYC status (admin).
   */
  async getAdminKycList(
    statusFilter?: string,
    page = 1,
    limit = 20,
  ): Promise<{
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const where: { kycStatus?: KycStatus } = {};
    if (statusFilter) {
      where.kycStatus = statusFilter as KycStatus;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const [users, total] = await this.userRepository.findAndCount({
      where,
      skip: (page - 1) * limit,
      take: limit,
      order: { createdAt: 'DESC' },
      select: [
        'id',
        'walletAddress',
        'kycStatus',
        'role',
        'isActive',
        'displayName',
        'email',
        'createdAt',
        'updatedAt',
      ],
    });

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }
}
