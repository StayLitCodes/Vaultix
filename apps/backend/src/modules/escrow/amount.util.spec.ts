import {
  baseUnitsToDecimal,
  decimalToBaseUnits,
  I128_MAX,
  assertAmountConservation,
} from './amount.util';

describe('exact escrow amounts', () => {
  it('round trips one base unit and maximum supported precision', () => {
    expect(decimalToBaseUnits('0.0000001')).toBe(1n);
    expect(baseUnitsToDecimal(1n)).toBe('0.0000001');
    expect(decimalToBaseUnits('12.3456789')).toBe(123456789n);
  });

  it('preserves large values exactly through i128 bounds', () => {
    expect(decimalToBaseUnits(baseUnitsToDecimal(I128_MAX))).toBe(I128_MAX);
    expect(() => decimalToBaseUnits((I128_MAX + 1n).toString())).toThrow();
  });

  it.each(['1.00000001', '1e3', '-1', '01', ' 1'])(
    'rejects invalid amount %s',
    (amount) => {
      expect(() => decimalToBaseUnits(amount)).toThrow();
    },
  );

  it('enforces partial release and refund conservation', () => {
    const total = decimalToBaseUnits('10');
    const released = decimalToBaseUnits('3.25');
    const refunded = decimalToBaseUnits('6.75');
    expect(() =>
      assertAmountConservation(total, released, refunded),
    ).not.toThrow();
    expect(() =>
      assertAmountConservation(total, released, refunded + 1n),
    ).toThrow();
  });
});
