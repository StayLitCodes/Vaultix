import { QRScanResult } from "../types/qr";

const STELLAR_REGEX = /^G[A-Z2-7]{55}$/;

// Escrow IDs are backend-assigned opaque identifiers. UUIDs are the common
// production shape, but the character class also supports other safe IDs.
export const ESCROW_ID_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{5,127}$/;
const ESCROW_SHARE_URL_REGEX =
  /^https:\/\/[^/]+\/escrow\/([A-Za-z0-9][A-Za-z0-9_-]{5,127})\/?$/;

function isAllowedEscrowHost(hostname: string): boolean {
  const configuredBaseUrl =
    process.env.EXPO_PUBLIC_WEB_BASE_URL ?? "https://vaultix.app";

  try {
    const configuredHost = new URL(configuredBaseUrl).hostname;
    return hostname === configuredHost || hostname === "vaultix.app";
  } catch {
    return hostname === "vaultix.app";
  }
}

function extractEscrowId(value: string): string | null {
  const match = ESCROW_SHARE_URL_REGEX.exec(value);
  if (!match) return null;

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !isAllowedEscrowHost(url.hostname)) {
      return null;
    }
  } catch {
    return null;
  }

  return ESCROW_ID_REGEX.test(match[1]) ? match[1] : null;
}

export function validateQRCode(rawValue: string): QRScanResult {
  const value = rawValue.trim();

  if (STELLAR_REGEX.test(value)) {
    return {
      type: "stellar_address",
      value,
    };
  }

  const escrowId = extractEscrowId(value);
  if (escrowId) {
    return {
      type: "escrow_id",
      value: escrowId,
    };
  }

  return {
    type: "invalid",
    value,
  };
}
