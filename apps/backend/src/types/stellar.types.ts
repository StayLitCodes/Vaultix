// Type definitions for Stellar SDK to avoid 'any' usage
import * as StellarSdk from '@stellar/stellar-sdk';
export interface StellarAccountResponse extends StellarSdk.Account {
  id: string;
  account_id: string;
  sequence: string;
  balances: Array<{
    balance: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
  thresholds: {
    low_threshold: number;
    med_threshold: number;
    high_threshold: number;
  };
  flags: {
    auth_required: boolean;
    auth_revocable: boolean;
    auth_immutable: boolean;
  };
  signers: Array<{
    key: string;
    weight: number;
    type: string;
  }>;
  data: Record<string, string>;
}

export interface StellarSubmitTransactionResponse {
  hash: string;
  ledger: number;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
  paging_token: string;
}

export interface StellarTransactionResponse {
  id: string;
  paging_token: string;
  successful: boolean;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  source_account_sequence: string;
  fee_charged: string;
  max_fee: string;
  operation_count: number;
  envelope_xdr: string;
  result_xdr: string;
  result_meta_xdr: string;
  fee_meta_xdr: string;
  memo_type: string;
  memo?: string;
  signatures: string[];
  valid_after?: string;
  valid_before?: string;
}

export interface StellarHorizonError {
  type: string;
  title: string;
  status: number;
  detail: string;
  extras?: {
    envelope_xdr: string;
    result_codes: {
      transaction: string;
      operations?: string[];
    };
    result_xdr: string;
  };
}

export type StellarServer = any; // For now, keep as any but we'll use this alias for future typing
