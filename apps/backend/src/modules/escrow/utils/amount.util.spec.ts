import {
  baseUnitsToDecimal,
  decimalToBaseUnits,
  InvalidAmountError,
  splitBaseUnits,
} from './amount.util';

describe('exact escrow amounts', () => {
  it('round trips one base unit and the precision boundary', () => {
    expect(decimalToBaseUnits('0.0000001', 7)).toBe(1n);
    expect(baseUnitsToDecimal(1n, 7)).toBe('0.0000001');
    expect(() => decimalToBaseUnits('0.00000001', 7)).toThrow(
      InvalidAmountError,
    );
  });

  it('supports large i128-safe amounts without Number conversion', () => {
    const amount = '170141183460469231731687303715.123456789';
    const baseUnits = decimalToBaseUnits(amount, 9);
    expect(baseUnitsToDecimal(baseUnits, 9)).toBe(amount);
    expect(() => decimalToBaseUnits(`${amount}0`, 9)).toThrow();
  });

  it('rejects malformed, zero, negative, and overflowing values', () => {
    for (const amount of ['1e3', '1.', '.1', '-1', '0']) {
      expect(() => decimalToBaseUnits(amount, 7)).toThrow();
    }
    expect(() =>
      decimalToBaseUnits('170141183460469231731687303715884105728', 0),
    ).toThrow();
  });

  it('conserves fractional milestone sums in base units', () => {
    const parts = splitBaseUnits(decimalToBaseUnits('1', 7), 3);
    expect(parts).toEqual([3333334n, 3333333n, 3333333n]);
    expect(parts.reduce((sum, part) => sum + part, 0n)).toBe(10000000n);
  });
});