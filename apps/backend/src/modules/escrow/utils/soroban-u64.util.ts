const U64_MAX = (1n << 64n) - 1n;
const U64_RE = /^(0|[1-9][0-9]{0,19})$/;

export function validateSorobanU64(value: string): string {
  if (
    typeof value !== 'string' ||
    !U64_RE.test(value) ||
    BigInt(value) > U64_MAX
  ) {
    throw new RangeError(`Invalid Soroban u64 decimal string: ${value}`);
  }
  return value;
}
