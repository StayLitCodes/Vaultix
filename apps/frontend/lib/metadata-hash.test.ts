import { normalizeMetadataHash } from '@/lib/metadata-hash';

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const BASE58BTC_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

describe('normalizeMetadataHash', () => {
  const digest = Uint8Array.from(
    Array.from({ length: 32 }, (_, index) => index + 1),
  );
  const digestHex = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');

  it('normalizes raw hex digests', () => {
    expect(normalizeMetadataHash(digestHex.toUpperCase())).toBe(digestHex);
  });

  it('normalizes cidv1 base32 references', () => {
    const cid = `b${encodeBase32(
      Uint8Array.from([0x01, 0x55, 0x12, 0x20, ...digest]),
    )}`;

    expect(normalizeMetadataHash(`ipfs://${cid}`)).toBe(digestHex);
  });

  it('normalizes cidv0 base58 references', () => {
    const cid = encodeBase58(Uint8Array.from([0x12, 0x20, ...digest]));

    expect(normalizeMetadataHash(cid)).toBe(digestHex);
  });

  it('rejects non-sha256 multihashes', () => {
    const cid = `b${encodeBase32(
      Uint8Array.from([0x01, 0x55, 0x13, 0x20, ...digest]),
    )}`;

    expect(() => normalizeMetadataHash(cid)).toThrow('sha2-256');
  });
});

function encodeBase32(bytes: Uint8Array): string {
  let bits = 0;
  let bitCount = 0;
  let output = '';

  for (const byte of bytes) {
    bits = (bits << 8) | byte;
    bitCount += 8;

    while (bitCount >= 5) {
      bitCount -= 5;
      output += BASE32_ALPHABET[(bits >> bitCount) & 31];
    }
  }

  if (bitCount > 0) {
    output += BASE32_ALPHABET[(bits << (5 - bitCount)) & 31];
  }

  return output;
}

function encodeBase58(bytes: Uint8Array): string {
  if (bytes.length === 0) {
    return '';
  }

  const digits = [0];
  for (const byte of bytes) {
    let carry = byte;
    for (let i = 0; i < digits.length; i += 1) {
      const next = digits[i] * 256 + carry;
      digits[i] = next % 58;
      carry = Math.floor(next / 58);
    }

    while (carry > 0) {
      digits.push(carry % 58);
      carry = Math.floor(carry / 58);
    }
  }

  let output = '';
  for (let i = 0; i < bytes.length && bytes[i] === 0; i += 1) {
    output += BASE58BTC_ALPHABET[0];
  }

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    output += BASE58BTC_ALPHABET[digits[i]];
  }

  return output;
}
