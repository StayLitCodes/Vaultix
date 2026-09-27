/** Exact Stellar amount conversion. Stellar's supported maximum precision is 7. */
export const STELLAR_ASSET_DECIMALS = 7;
export const I128_MAX = (1n << 127n) - 1n;

export function decimalToBaseUnits(
  value: string,
  decimals = STELLAR_ASSET_DECIMALS,
): bigint {
  if (
    typeof value !== 'string' ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > 7
  )
    throw new Error('Invalid amount or asset precision');
  const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(value);
  if (!match || (match[2]?.length ?? 0) > decimals)
    throw new Error('Malformed amount or excessive precision');
  const scale = 10n ** BigInt(decimals);
  const units =
    BigInt(match[1]) * scale +
    BigInt((match[2] ?? '').padEnd(decimals, '0') || '0');
  if (units < 0n || units > I128_MAX)
    throw new Error('Amount is outside the supported i128 range');
  return units;
}

export function baseUnitsToDecimal(
  units: bigint,
  decimals = STELLAR_ASSET_DECIMALS,
): string {
  if (units < 0n || units > I128_MAX)
    throw new Error('Amount is outside the supported i128 range');
  const scale = 10n ** BigInt(decimals);
  const fraction = (units % scale)
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '');
  return fraction ? `${units / scale}.${fraction}` : (units / scale).toString();
}

export function assertAmountConservation(
  total: bigint,
  released: bigint,
  refunded: bigint,
): void {
  if (
    total < 0n ||
    released < 0n ||
    refunded < 0n ||
    released + refunded > total
  )
    throw new Error(
      'Released and refunded amounts cannot exceed the escrow total',
    );
}
