/**
 * Fee tier definitions for dynamic platform fees
 * Format: [volumeCap, feeBps]
 * Where volumeCap is the upper bound for the tier (in XLM) and feeBps is the fee in basis points
 */
export const STROOPS_PER_XLM = 10_000_000;

export const FEE_TIERS: Array<[number, number]> = [
  [1000 * STROOPS_PER_XLM, 50],
  [5000 * STROOPS_PER_XLM, 30],
  [10000 * STROOPS_PER_XLM, 20],
  [Number.MAX_SAFE_INTEGER, 10], // 10,001+ XLM => 10 bps (0.1%)
];

/**
 * Default fee in basis points used as fallback
 */
export const DEFAULT_FEE_BPS = 50; // 0.5%

/**
 * Basis points denominator (10,000 bps = 100%)
 */
export const BPS_DENOMINATOR = 10_000;

/**
 * Helper to get fee percentage as a decimal (e.g., 0.005 for 50 bps)
 */
export function getBpsAsDecimal(bps: number): number {
  return bps / BPS_DENOMINATOR;
}

/**
 * Helper to get fee percentage as a percentage string (e.g., "0.5%" for 50 bps)
 */
export function getBpsAsPercentage(bps: number): string {
  return `${((bps / BPS_DENOMINATOR) * 100).toFixed(2)}%`;
}
