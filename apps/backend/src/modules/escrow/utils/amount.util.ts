export const DEFAULT_ASSET_DECIMALS = 7;
export const MAX_I128 = (1n << 127n) - 1n;

const DECIMAL_AMOUNT = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

export class InvalidAmountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAmountError';
  }
}

export function decimalToBaseUnits(
  value: string,
  decimals: number,
): bigint {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18 ||
    typeof value !== 'string' ||
    !DECIMAL_AMOUNT.test(value)
  ) {
    throw new InvalidAmountError('Amount must be a valid decimal string');
  }

  const [whole, fraction = ''] = value.split('.');
  if (fraction.length > decimals) {
    throw new InvalidAmountError(
      `Amount has more than ${decimals} decimal places`,
    );
  }

  const baseUnits =
    BigInt(whole) * 10n ** BigInt(decimals) + BigInt(fraction.padEnd(decimals, '0') || '0');
  if (baseUnits <= 0n || baseUnits > MAX_I128) {
    throw new InvalidAmountError('Amount is outside the supported range');
  }
  return baseUnits;
}

export function baseUnitsToDecimal(value: bigint, decimals: number): string {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 18 ||
    value < 0n ||
    value > MAX_I128
  ) {
    throw new InvalidAmountError('Base-unit amount is outside the supported range');
  }

  if (decimals === 0) return value.toString();
  const scale = 10n ** BigInt(decimals);
  const whole = value / scale;
  const fraction = value % scale;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(decimals, '0').replace(/0+$/, '')}`;
}

export function splitBaseUnits(total: bigint, count: number): bigint[] {
  if (count < 1 || !Number.isInteger(count) || total < 0n) {
    throw new InvalidAmountError('Milestone count is invalid');
  }
  const quotient = total / BigInt(count);
  const remainder = total % BigInt(count);
  return Array.from({ length: count }, (_, index) =>
    quotient + (BigInt(index) < remainder ? 1n : 0n),
  );
}
