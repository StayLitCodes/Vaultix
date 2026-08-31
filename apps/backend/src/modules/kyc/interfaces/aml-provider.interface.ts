/**
 * Result of screening a wallet address against AML/sanctions lists.
 */
export interface AmlScreeningResult {
  /** Whether the address is flagged as suspicious */
  flagged: boolean;
  /** Risk level: low, medium, high, critical */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** List of sanctions lists the address appears on */
  sanctionsLists?: string[];
  /** Human-readable reason for the flag */
  reason?: string;
  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Pluggable AML screening provider interface.
 *
 * Implement this interface to integrate with a specific AML/chain analysis provider
 * (Chainalysis, Elliptic, TRM Labs, etc.).
 *
 * The screening provider checks wallet addresses against known sanctions lists,
 * darknet markets, scams, and other illicit activity databases.
 */
export interface IAmlProvider {
  /** Provider identifier */
  readonly name: string;

  /**
   * Screen a wallet address against AML/sanctions databases.
   * @param walletAddress - The wallet address to screen
   */
  screenAddress(walletAddress: string): Promise<AmlScreeningResult>;

  /**
   * Batch screen multiple addresses at once (for efficiency).
   * @param walletAddresses - Array of wallet addresses to screen
   */
  screenAddresses?(
    walletAddresses: string[],
  ): Promise<Record<string, AmlScreeningResult>>;
}
