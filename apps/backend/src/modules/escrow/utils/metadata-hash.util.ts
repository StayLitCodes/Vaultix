const SHA256_MULTIHASH_CODE = 0x12;
const SHA256_DIGEST_LENGTH = 32;
const CID_V1 = 1;

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';
const BASE58BTC_ALPHABET =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const HEX_32_RE = /^[0-9a-f]{64}$/;

export function normalizeMetadataHash(reference: string): string {
  const value = sanitizeReference(reference);
  const lowered = value.toLowerCase();

  if (HEX_32_RE.test(lowered)) {
    return lowered;
  }

  const cid = extractCid(value);
  const digest = cid.startsWith('Qm')
    ? extractDigestFromCidV0(cid)
    : extractDigestFromCidV1(cid);

  return bytesToHex(digest);
}

function sanitizeReference(reference: string): string {
  if (!reference) {
    throw new Error('metadata hash is required');
  }
  const value = reference.trim();
  if (!value) {
    throw new Error('metadata hash is required');
  }

  return value;
}

function extractCid(reference: string): string {
  if (!reference.toLowerCase().startsWith('ipfs://')) {
    return reference;
  }

  const withoutScheme = reference.slice('ipfs://'.length);
  const cid = withoutScheme.split(/[/?#]/, 1)[0];
  if (!cid) {
    throw new Error('invalid ipfs reference');
  }

  return cid;
}

function extractDigestFromCidV0(cid: string): Uint8Array {
  return parseMultihash(decodeBase58(cid));
}

function extractDigestFromCidV1(cid: string): Uint8Array {
  const multibase = cid[0];
  const payload = cid.slice(1);

  if (!payload) {
    throw new Error('invalid cid');
  }

  let decoded: Uint8Array;
  if (multibase === 'b' || multibase === 'B') {
    decoded = decodeBase32(payload.toLowerCase());
  } else if (multibase === 'z') {
    decoded = decodeBase58(payload);
  } else {
    throw new Error('unsupported cid multibase');
  }

  let offset = 0;
  const version = readVarint(decoded, offset);
  offset = version.nextOffset;
  if (version.value !== CID_V1) {
    throw new Error('unsupported cid version');
  }

  const codec = readVarint(decoded, offset);
  offset = codec.nextOffset;
  void codec;

  return parseMultihash(decoded.slice(offset));
}

function parseMultihash(bytes: Uint8Array): Uint8Array {
  let offset = 0;
  const code = readVarint(bytes, offset);
  offset = code.nextOffset;
  const length = readVarint(bytes, offset);
  offset = length.nextOffset;

  if (code.value !== SHA256_MULTIHASH_CODE) {
    throw new Error('metadata hash must use sha2-256');
  }

  if (length.value !== SHA256_DIGEST_LENGTH) {
    throw new Error('metadata hash digest must be 32 bytes');
  }

  const digest = bytes.slice(offset, offset + length.value);
  if (digest.length !== SHA256_DIGEST_LENGTH) {
    throw new Error('metadata hash digest is truncated');
  }

  if (offset + length.value !== bytes.length) {
    throw new Error('invalid multihash length');
  }

  return digest;
}

function readVarint(
  bytes: Uint8Array,
  offset: number,
): { value: number; nextOffset: number } {
  let value = 0;
  let shift = 0;
  let index = offset;

  while (index < bytes.length) {
    const current = bytes[index];
    value |= (current & 0x7f) << shift;
    index += 1;

    if ((current & 0x80) === 0) {
      return { value, nextOffset: index };
    }

    shift += 7;
    if (shift > 28) {
      throw new Error('varint is too large');
    }
  }

  throw new Error('unexpected end of varint');
}

function decodeBase32(value: string): Uint8Array {
  let bits = 0;
  let bitCount = 0;
  const bytes: number[] = [];

  for (const char of value) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('invalid base32 cid');
    }

    bits = (bits << 5) | index;
    bitCount += 5;

    while (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((bits >> bitCount) & 0xff);
    }
  }

  return Uint8Array.from(bytes);
}

function decodeBase58(value: string): Uint8Array {
  const bytes: number[] = [0];

  for (const char of value) {
    const carryIndex = BASE58BTC_ALPHABET.indexOf(char);
    if (carryIndex === -1) {
      throw new Error('invalid base58 cid');
    }

    let carry = carryIndex;
    for (let i = 0; i < bytes.length; i += 1) {
      const next = bytes[i] * 58 + carry;
      bytes[i] = next & 0xff;
      carry = next >> 8;
    }

    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }

  for (
    let i = 0;
    i < value.length && value[i] === BASE58BTC_ALPHABET[0];
    i += 1
  ) {
    bytes.push(0);
  }

  bytes.reverse();
  return Uint8Array.from(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
