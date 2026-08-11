import {
    FEE_TIERS,
    DEFAULT_FEE_BPS,
    BPS_DENOMINATOR,
} from './fee.constants';

/**
 * Calculate tiered fee basis points based on transaction volume
 * Uses tier-based system where higher volumes get lower fees
 *
 * @param volume - Amount in base units (e.g., XLM stroops or smallest token unit)
 * @returns Fee in basis points
 *
 * @example
 * calculateTieredFeeBps(500_000_000) // 50 bps for 500 XLM
 * calculateTieredFeeBps(2_000_000_000) // 30 bps for 2000 XLM
 */
export function calculateTieredFeeBps(volume: number): number {
    if (volume <= 0) {
        return DEFAULT_FEE_BPS;
    }

    for (const [cap, bps] of FEE_TIERS) {
        if (volume <= cap) {
            return bps;
        }
    }

    // Fallback to lowest tier (should not reach here with proper tier setup)
    return DEFAULT_FEE_BPS;
}

/**
 * Calculate platform fee amount based on transaction amount and tiered fee structure
 *
 * @param amount - Transaction amount in base units
 * @returns Fee amount in base units
 *
 * @example
 * calculateFee(1_000_000_000) // 1000 XLM => 5_000_000 stroops (50 bps)
 * calculateFee(5_000_000_000) // 5000 XLM => 15_000_000 stroops (30 bps)
 */
export function calculateFee(amount: number): number {
    const feeBps = calculateTieredFeeBps(amount);
    return Math.floor((amount * feeBps) / BPS_DENOMINATOR);
}

/**
 * Calculate net amount after platform fee deduction
 *
 * @param amount - Total transaction amount in base units
 * @returns Object containing fee, netAmount, and feeBps
 *
 * @example
 * const { fee, netAmount, feeBps } = calculateNetAmount(1_000_000_000);
 * // { fee: 5_000_000, netAmount: 995_000_000, feeBps: 50 }
 */
export function calculateNetAmount(amount: number): {
    fee: number;
    netAmount: number;
    feeBps: number;
} {
    const feeBps = calculateTieredFeeBps(amount);
    const fee = Math.floor((amount * feeBps) / BPS_DENOMINATOR);
    const netAmount = amount - fee;

    return {
        fee,
        netAmount,
        feeBps,
    };
}

/**
 * Get the applicable fee tier for a given volume
 *
 * @param volume - Amount in base units
 * @returns Tier information including cap, bps, and readable description
 *
 * @example
 * getFeeTier(2_000_000_000) // { cap: 5000, bps: 30, range: "1,001 - 5,000 XLM" }
 */
export function getFeeTier(volume: number): {
    cap: number;
    bps: number;
    range: string;
} {
    const feeBps = calculateTieredFeeBps(volume);

    // Find the tier that applies
    for (let i = 0; i < FEE_TIERS.length; i++) {
        const [cap, bps] = FEE_TIERS[i];
        if (bps === feeBps) {
            const prevCap = i > 0 ? FEE_TIERS[i - 1][0] : 0;
            const isMaxTier = i === FEE_TIERS.length - 1;

            const range = isMaxTier
                ? `${(prevCap + 1).toLocaleString()}+ XLM`
                : `${(prevCap + 1).toLocaleString()} - ${cap.toLocaleString()} XLM`;

            return {
                cap,
                bps,
                range,
            };
        }
    }

    return {
        cap: Number.MAX_SAFE_INTEGER,
        bps: DEFAULT_FEE_BPS,
        range: '0+ XLM',
    };
}

/**
 * Format fee information for display
 *
 * @param amount - Transaction amount in base units
 * @param decimals - Number of decimal places for the asset (e.g., 7 for XLM)
 * @returns Formatted display object
 *
 * @example
 * formatFeeDisplay(1_000_000_000, 7)
 * // { 
 * //   amount: "1000 XLM",
 * //   fee: "5 XLM", 
 * //   net: "995 XLM",
 * //   percentage: "0.50%"
 * // }
 */
export function formatFeeDisplay(
    amount: number,
    decimals: number = 7,
    symbol: string = 'XLM',
): {
    amount: string;
    fee: string;
    net: string;
    percentage: string;
} {
    const { fee, netAmount, feeBps } = calculateNetAmount(amount);
    const divisor = Math.pow(10, decimals);

    return {
        amount: `${(amount / divisor).toFixed(decimals)} ${symbol}`,
        fee: `${(fee / divisor).toFixed(decimals)} ${symbol}`,
        net: `${(netAmount / divisor).toFixed(decimals)} ${symbol}`,
        percentage: `${(feeBps / 100).toFixed(2)}%`,
    };
}
