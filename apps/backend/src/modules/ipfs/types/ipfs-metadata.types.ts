export interface EscrowMetadata {
  escrowId: string;
  buyer: string;
  seller: string;
  amount: string;
  asset: string;
  conditions: EscrowConditionMetadata[];
  deadline: string;
  status: string;
  timestamp: string;
  version: number;
  previousCid?: string;
  [key: string]: unknown; // Index signature for Record compatibility
}

export interface EscrowConditionMetadata {
  description: string;
  type: string;
  fulfilled: boolean;
}

export interface MetadataVerificationResult {
  isValid: boolean;
  escrowId: string;
  computedHash: string;
  storedHash: string;
  metadata: EscrowMetadata;
  errors?: string[];
}
