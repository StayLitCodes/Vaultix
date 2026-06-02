import { QRScanResult } from "../types/qr";

const STELLAR_REGEX = /^G[A-Z2-7]{55}$/;
const ESCROW_REGEX = /^ESCROW_[A-Z0-9_-]{6,64}$/;

export function validateQRCode(
  rawValue: string
): QRScanResult {

  const value = rawValue.trim();

  if (STELLAR_REGEX.test(value)) {
    return {
      type: "stellar_address",
      value,
    };
  }

  if (ESCROW_REGEX.test(value)) {
    return {
      type: "escrow_id",
      value,
    };
  }

  return {
    type: "invalid",
    value,
  };
}