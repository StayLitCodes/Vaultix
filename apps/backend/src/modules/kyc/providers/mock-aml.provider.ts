import { Injectable, Logger } from '@nestjs/common';
import {
  IAmlProvider,
  AmlScreeningResult,
} from '../interfaces/aml-provider.interface';

/**
 * Mock AML screening provider for development and testing.
 *
 * Simulates AML screening by checking a hardcoded list of "risky" addresses.
 * In production, replace with a provider that integrates with Chainalysis,
 * Elliptic, or TRM Labs APIs.
 */
@Injectable()
export class MockAmlProvider implements IAmlProvider {
  private readonly logger = new Logger(MockAmlProvider.name);
  readonly name = 'mock';

  /** Known risky addresses for testing */
  private readonly sanitizedAddresses = new Set([
    // Example sanctioned addresses for testing
    'GBS4T7FEI5JUZP7ZLHREAVHXKDHGTVRWCTQQ7HTM3UAGLNYXZUCJ4CZN',
    'GCVMR4EC3YX3MFMCJJ4ANE5CZA2NHXIMXIIFZNATWMGRY6DLUWAONWFL',
  ]);

  async screenAddress(walletAddress: string): Promise<AmlScreeningResult> {
    const isFlagged = this.sanitizedAddresses.has(walletAddress);

    const result: AmlScreeningResult = isFlagged
      ? {
          flagged: true,
          riskLevel: 'high',
          sanctionsLists: ['OFAC_SDN_LIST'],
          reason:
            'Address found on sanctions screening list (OFAC SDN)',
          metadata: { provider: 'mock', screenedAt: new Date().toISOString() },
        }
      : {
          flagged: false,
          riskLevel: 'low',
          metadata: { provider: 'mock', screenedAt: new Date().toISOString() },
        };

    this.logger.log(
      `AML screening for ${walletAddress}: flagged=${result.flagged}, risk=${result.riskLevel}`,
    );

    return result;
  }

  async screenAddresses(
    walletAddresses: string[],
  ): Promise<Record<string, AmlScreeningResult>> {
    const results: Record<string, AmlScreeningResult> = {};

    for (const address of walletAddresses) {
      results[address] = await this.screenAddress(address);
    }

    return results;
  }
}
