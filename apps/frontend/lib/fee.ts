/**
 * Frontend fee tier definitions for dynamic platform fees
 * Must match backend and contract definitions
 */

export const FEE_TIERS = [
    { cap: 1000, bps: 50, label: '0 - 1,000 XLM' },        // 0-1,000 XLM => 50 bps (0.5%)
    { cap: 5000, bps: 30, label: '1,001 - 5,000 XLM' },    // 1,001-5,000 XLM => 30 bps (0.3%)
    { cap: 10000, bps: 20, label: '5,001 - 10,000 XLM' },  // 5,001-10,000 XLM => 20 bps (0.2%)
    { cap: Number.MAX_SAFE_INTEGER, bps: 10, label: '10,001+ XLM' }, // 10,001+ XLM => 10 bps (0.1%)
];

export const DEFAULT_FEE_BPS = 50; // 0.5%
export const BPS_DENOMINATOR = 10_000;

/**
 * Calculate tiered fee basis points based on transaction volume (in displayed units, e.g., XLM)
 * @param volumeXlm - Amount in XLM
 * @returns Fee in basis points
 */
export function calculateTieredFeeBps(volumeXlm: number): number {
    if (volumeXlm <= 0) {
        return DEFAULT_FEE_BPS;
    }

    for (const { cap, bps } of FEE_TIERS) {
        if (volumeXlm <= cap) {
            return bps;
        }
    }

    return DEFAULT_FEE_BPS;
}

/**
 * Calculate platform fee amount
 * @param amount - Transaction amount (in displayed units)
 * @returns Fee amount (in displayed units)
 */
export function calculateFee(amount: number): number {
    const feeBps = calculateTieredFeeBps(amount);
    return (amount * feeBps) / BPS_DENOMINATOR;
}

/**
 * Get current applicable tier for an amount
 * @param amountXlm - Amount in XLM
 * @returns Tier object
 */
export function getFeeTier(amountXlm: number) {
    for (const tier of FEE_TIERS) {
        if (amountXlm <= tier.cap) {
            return tier;
        }
    }
    return FEE_TIERS[FEE_TIERS.length - 1];
}

/**
 * Format fee percentage for display
 * @param bps - Basis points
 * @returns Formatted percentage string (e.g., "0.50%")
 */
export function formatFeePercentage(bps: number): string {
    return `${(bps / 100).toFixed(2)}%`;
}
