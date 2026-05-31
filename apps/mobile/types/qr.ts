export type QRScanType =
  | "stellar_address"
  | "escrow_id"
  | "invalid";

export interface QRScanResult {
  type: QRScanType;
  value: string;
}