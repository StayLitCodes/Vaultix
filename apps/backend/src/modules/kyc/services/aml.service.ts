import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entities/user.entity';
import {
  IAmlProvider,
  AmlScreeningResult,
} from '../interfaces/aml-provider.interface';
import { MockAmlProvider } from '../providers/mock-aml.provider';

/**
 * Anti-Money Laundering (AML) screening service.
 *
 * Screens wallet addresses against sanctions lists and known illicit activity
 * databases using a pluggable provider pattern.
 *
 * By default uses MockAmlProvider in development. Configure AML_PROVIDER
 * environment variable to switch to a production provider (Chainalysis, etc.).
 */
@Injectable()
export class AmlService {
  private readonly logger = new Logger(AmlService.name);
  private readonly provider: IAmlProvider;

  /** Cache of recent screening results to avoid redundant API calls */
  private readonly resultCache = new Map<string, AmlScreeningResult>();

  /** How long to cache results (5 minutes) */
  private readonly cacheTtlMs = 5 * 60 * 1000;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly mockProvider: MockAmlProvider,
  ) {
    // Use the mock provider by default; swap for real provider in production
    this.provider = mockProvider;
  }

  /**
   * Screen a wallet address against AML/sanctions databases.
   */
  async screenAddress(walletAddress: string): Promise<AmlScreeningResult> {
    // Check cache first
    const cached = this.resultCache.get(walletAddress);
    if (cached) {
      return cached;
    }

    const result = await this.provider.screenAddress(walletAddress);

    // Cache the result
    this.resultCache.set(walletAddress, result);
    setTimeout(() => this.resultCache.delete(walletAddress), this.cacheTtlMs);

    if (result.flagged) {
      this.logger.warn(
        `AML flag raised for address ${walletAddress}: ${result.reason}`,
      );
    }

    return result;
  }

  /**
   * Screen a user's wallet address.
   * Convenience method that looks up the user and screens their address.
   */
  async screenUser(userId: string): Promise<AmlScreeningResult> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'walletAddress'],
    });

    if (!user) {
      return {
        flagged: false,
        riskLevel: 'low',
        reason: 'User not found',
      };
    }

    return this.screenAddress(user.walletAddress);
  }

  /**
   * Screen all parties in an escrow transaction.
   * Returns true if all addresses pass screening.
   */
  async screenTransactionParties(
    walletAddresses: string[],
  ): Promise<{
    passed: boolean;
    results: Record<string, AmlScreeningResult>;
  }> {
    const results: Record<string, AmlScreeningResult> = {};

    for (const address of walletAddresses) {
      results[address] = await this.screenAddress(address);
    }

    const allPassed = Object.values(results).every((r) => !r.flagged);

    if (!allPassed) {
      this.logger.warn(
        'AML screening failed for transaction: some addresses are flagged',
      );
    }

    return { passed: allPassed, results };
  }
}
