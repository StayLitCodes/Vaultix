// DTOs and types for the Consistency Checker feature

export type ConsistencyCheckRequest =
  | { escrowIds: number[] }
  | { fromId: number; toId: number };

export interface FieldMismatch {
  fieldName: string;
  dbValue: unknown;
  onchainValue: unknown;
}

export interface EscrowDiffReport {
  escrowId: number;
  isConsistent: boolean;
  fieldsMismatched: FieldMismatch[];
  missingInDb?: boolean;
  missingOnChain?: boolean;
  error?: string;
}

export interface ConsistencyCheckResponse {
  reports: EscrowDiffReport[];
  summary: {
    totalChecked: number;
    totalInconsistent: number;
    totalMissingInDb: number;
    totalMissingOnChain: number;
    totalErrored: number;
  };
}
