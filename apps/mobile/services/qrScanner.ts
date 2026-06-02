import { validateQRCode } from "../utils/qrValidation";

export function processScannedQRCode(
  scannedValue: string
) {
  return validateQRCode(scannedValue);
}