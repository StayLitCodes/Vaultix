import {
  calculateTieredFeeBps,
  calculateFee,
  calculateNetAmount,
  getFeeTier,
  formatFeeDisplay,
  FEE_TIERS,
  BPS_DENOMINATOR,
} from './fee.util';

const XLM = 10_000_000;

describe('Fee Calculation Utilities', () => {
  describe('calculateTieredFeeBps', () => {
    it('should return 50 bps for amounts 0-1000', () => {
      expect(calculateTieredFeeBps(500 * XLM)).toBe(50);
      expect(calculateTieredFeeBps(1000 * XLM)).toBe(50);
    });

    it('should return 30 bps for amounts 1001-5000', () => {
      expect(calculateTieredFeeBps(1000 * XLM + 1)).toBe(30);
      expect(calculateTieredFeeBps(5000 * XLM)).toBe(30);
    });

    it('should return 20 bps for amounts 5001-10000', () => {
      expect(calculateTieredFeeBps(5000 * XLM + 1)).toBe(20);
      expect(calculateTieredFeeBps(10000 * XLM)).toBe(20);
    });

    it('should return 10 bps for amounts 10001+', () => {
      expect(calculateTieredFeeBps(10000 * XLM + 1)).toBe(10);
      expect(calculateTieredFeeBps(100000 * XLM)).toBe(10);
    });

    it('should return default fee for zero or negative amounts', () => {
      expect(calculateTieredFeeBps(0)).toBe(50);
      expect(calculateTieredFeeBps(-1)).toBe(50);
    });
  });

  describe('calculateFee', () => {
    it('should calculate fee correctly for tier 1 (50 bps)', () => {
      // 1000 * 50 / 10000 = 5
      expect(calculateFee(1000 * XLM)).toBe(5 * XLM);
    });

    it('should calculate fee correctly for tier 2 (30 bps)', () => {
      // 5000 * 30 / 10000 = 15
      expect(calculateFee(5000 * XLM)).toBe(15 * XLM);
    });

    it('should calculate fee correctly for tier 3 (20 bps)', () => {
      // 10000 * 20 / 10000 = 20
      expect(calculateFee(10000 * XLM)).toBe(20 * XLM);
    });

    it('should calculate fee correctly for tier 4 (10 bps)', () => {
      // 100000 * 10 / 10000 = 100
      expect(calculateFee(100000 * XLM)).toBe(100 * XLM);
    });

    it('should floor results to avoid fractional amounts', () => {
      // 333 * 50 / 10000 = 1.665 => 1
      expect(calculateFee(333)).toBe(1);
    });
  });

  describe('calculateNetAmount', () => {
    it('should return fee and net amount correctly', () => {
      const result = calculateNetAmount(1000 * XLM);
      expect(result.fee).toBe(5 * XLM);
      expect(result.netAmount).toBe(995 * XLM);
      expect(result.feeBps).toBe(50);
    });

    it('should handle tier transitions correctly', () => {
      const tier1Result = calculateNetAmount(1000 * XLM);
      const tier2Result = calculateNetAmount(1000 * XLM + 1);

      expect(tier1Result.feeBps).toBe(50);
      expect(tier2Result.feeBps).toBe(30); // Lower fee for higher volume
      expect(tier2Result.fee).toBeLessThan(tier1Result.fee);
    });

    it('should ensure net amount never exceeds total amount', () => {
      const result = calculateNetAmount(10000 * XLM);
      expect(result.netAmount).toBeLessThanOrEqual(10000 * XLM);
      expect(result.netAmount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getFeeTier', () => {
    it('should return correct tier info for tier 1', () => {
      const tier = getFeeTier(500 * XLM);
      expect(tier.bps).toBe(50);
      expect(tier.range).toContain('1,000');
    });

    it('should return correct tier info for tier 2', () => {
      const tier = getFeeTier(2000 * XLM);
      expect(tier.bps).toBe(30);
      expect(tier.range).toContain('1,000');
      expect(tier.range).toContain('5,000');
    });

    it('should return correct tier info for tier 4 (max)', () => {
      const tier = getFeeTier(20000 * XLM);
      expect(tier.bps).toBe(10);
      expect(tier.range).toContain('10,000+');
    });
  });

  describe('formatFeeDisplay', () => {
    it('should format amounts correctly with XLM decimals', () => {
      const display = formatFeeDisplay(1_000_000_000, 7, 'XLM');
      expect(display.amount).toBe('100.0000000 XLM');
      expect(display.fee).toBe('0.5000000 XLM');
      expect(display.net).toBe('99.5000000 XLM');
      expect(display.percentage).toBe('0.50%');
    });

    it('should format correctly for different decimals', () => {
      // 1000 stroops with 7 decimals = 0.0001 XLM
      const display = formatFeeDisplay(1000, 7, 'XLM');
      expect(display.amount).toContain('0.00');
      expect(display.percentage).toBe('0.50%');
    });
  });

  describe('Edge cases', () => {
    it('should handle very large amounts', () => {
      const largeAmount = Number.MAX_SAFE_INTEGER - 1;
      const result = calculateNetAmount(largeAmount);
      expect(result.netAmount).toBeGreaterThan(0);
      expect(result.fee).toBeGreaterThan(0);
      expect(result.feeBps).toBe(10); // Highest tier
    });

    it('should handle minimal amounts', () => {
      const result = calculateNetAmount(1);
      expect(result.fee).toBe(0); // 1 * 50 / 10000 = 0.0005 => 0 (floored)
      expect(result.netAmount).toBe(1);
    });

    it('should ensure fee never exceeds amount', () => {
      for (let amount = 1; amount <= 100000; amount *= 10) {
        const result = calculateNetAmount(amount);
        expect(result.fee).toBeLessThanOrEqual(amount);
        expect(result.netAmount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('Tier boundaries', () => {
    it('should handle exact tier boundaries correctly', () => {
      expect(calculateTieredFeeBps(1000 * XLM)).toBe(50);
      expect(calculateTieredFeeBps(1000 * XLM + 1)).toBe(30);

      expect(calculateTieredFeeBps(5000 * XLM)).toBe(30);
      expect(calculateTieredFeeBps(5000 * XLM + 1)).toBe(20);

      expect(calculateTieredFeeBps(10000 * XLM)).toBe(20);
      expect(calculateTieredFeeBps(10000 * XLM + 1)).toBe(10);
    });
  });
});
