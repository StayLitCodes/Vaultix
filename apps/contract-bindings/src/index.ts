import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"EscrowNotFound"},
  2: {message:"EscrowAlreadyExists"},
  3: {message:"MilestoneNotFound"},
  4: {message:"MilestoneAlreadyReleased"},
  5: {message:"UnauthorizedAccess"},
  6: {message:"InvalidMilestoneAmount"},
  7: {message:"TotalAmountMismatch"},
  8: {message:"InsufficientBalance"},
  9: {message:"EscrowNotActive"},
  10: {message:"VectorTooLarge"},
  11: {message:"ZeroAmount"},
  12: {message:"InvalidDeadline"},
  13: {message:"SelfDealing"},
  14: {message:"EscrowAlreadyFunded"},
  15: {message:"TokenTransferFailed"},
  16: {message:"TreasuryNotInitialized"},
  17: {message:"InvalidFeeConfiguration"},
  18: {message:"AdminNotInitialized"},
  19: {message:"AlreadyInitialized"},
  20: {message:"InvalidEscrowStatus"},
  21: {message:"AlreadyInDispute"},
  22: {message:"InvalidWinner"},
  23: {message:"ContractPaused"},
  24: {message:"DeadlineNotReached"},
  25: {message:"InvalidStatusForRefund"},
  26: {message:"NoFundsToRefund"},
  27: {message:"Unauthorized"},
  28: {message:"OperatorNotInitialized"},
  29: {message:"ArbitratorNotInitialized"}
}


export interface Escrow {
  collected_signatures: Array<string>;
  deadline: u64;
  depositor: string;
  metadata_hash: Buffer;
  milestones: Array<Milestone>;
  recipient: string;
  required_signatures: u32;
  resolution: Resolution;
  status: EscrowStatus;
  threshold_amount: i128;
  token_address: string;
  total_amount: i128;
  total_released: i128;
}


export interface Milestone {
  amount: i128;
  description: string;
  status: MilestoneStatus;
}

export type Resolution = {tag: "None", values: void} | {tag: "Depositor", values: void} | {tag: "Recipient", values: void} | {tag: "Split", values: void};

export type EscrowStatus = {tag: "Created", values: void} | {tag: "Active", values: void} | {tag: "Completed", values: void} | {tag: "Cancelled", values: void} | {tag: "Disputed", values: void} | {tag: "Resolved", values: void} | {tag: "Expired", values: void};

export type ContractState = {tag: "Active", values: void} | {tag: "Paused", values: void};

export type MilestoneStatus = {tag: "Pending", values: void} | {tag: "Released", values: void} | {tag: "Disputed", values: void};


export interface CreateEscrowRequest {
  deadline: u64;
  depositor: string;
  escrow_id: u64;
  metadata_hash: Buffer;
  milestones: Array<Milestone>;
  recipient: string;
  token_address: string;
}


export interface EscrowCreatedBatchItem {
  deadline: u64;
  depositor: string;
  escrow_id: u64;
  recipient: string;
  token_address: string;
  total_amount: i128;
}

export interface Client {
  /**
   * Construct and simulate a init transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  init: ({admin, operator, arbitrator}: {admin: string, operator: string, arbitrator: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_state transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_state: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<EscrowStatus>>>

  /**
   * Construct and simulate a get_config transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_config: (options?: MethodOptions) => Promise<AssembledTransaction<Result<readonly [string, i128]>>>

  /**
   * Construct and simulate a get_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_escrow: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<Escrow>>>

  /**
   * Construct and simulate a initialize transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  initialize: ({treasury, fee_bps}: {treasury: string, fee_bps: Option<i128>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_paused: ({paused}: {paused: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a update_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  update_fee: ({new_fee_bps}: {new_fee_bps: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a cancel_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  cancel_escrow: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_escrow: ({escrow_id, depositor, recipient, token_address, milestones, deadline, metadata_hash}: {escrow_id: u64, depositor: string, recipient: string, token_address: string, milestones: Array<Milestone>, deadline: u64, metadata_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a deposit_funds transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  deposit_funds: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a raise_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  raise_dispute: ({escrow_id, caller}: {escrow_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_token_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set fee override for a specific token.
   * Only treasury (admin) can call this function.
   * 
   * # Arguments
   * * `env` - Soroban environment reference
   * * `token_address` - Address of the token to set fee for
   * * `fee_bps` - Fee in basis points (must be in range [0, BPS_DENOMINATOR])
   * 
   * # Returns
   * Ok(()) on success, or Error if validation fails
   */
  set_token_fee: ({token_address, fee_bps}: {token_address: string, fee_bps: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a refund_expired transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  refund_expired: ({escrow_id, caller}: {escrow_id: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_escrow_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Set fee override for a specific escrow.
   * Only treasury (admin) can call this function.
   * 
   * # Arguments
   * * `env` - Soroban environment reference
   * * `escrow_id` - ID of the escrow to set fee for
   * * `fee_bps` - Fee in basis points (must be in range [0, BPS_DENOMINATOR])
   * 
   * # Returns
   * Ok(()) on success, or Error if validation fails
   */
  set_escrow_fee: ({escrow_id, fee_bps}: {escrow_id: u64, fee_bps: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a complete_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  complete_escrow: ({escrow_id}: {escrow_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a resolve_dispute transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  resolve_dispute: ({escrow_id, winner, split_winner_amount}: {escrow_id: u64, winner: string, split_winner_amount: Option<i128>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a confirm_delivery transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  confirm_delivery: ({escrow_id, milestone_index, buyer}: {escrow_id: u64, milestone_index: u32, buyer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a collect_signature transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Collect a signature for releasing funds
   * The signature can come from either the depositor or a designated third party
   */
  collect_signature: ({escrow_id, signer}: {escrow_id: u64, signer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a release_milestone transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  release_milestone: ({escrow_id, milestone_index}: {escrow_id: u64, milestone_index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a configure_multisig transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Configure the threshold amount and required signatures for an escrow
   * Only the depositor can call this function
   */
  configure_multisig: ({escrow_id, threshold_amount, required_signatures}: {escrow_id: u64, threshold_amount: i128, required_signatures: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a create_escrows_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  create_escrows_batch: ({requests}: {requests: Array<CreateEscrowRequest>}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy(null, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAEaW5pdAAAAAMAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAIb3BlcmF0b3IAAAATAAAAAAAAAAphcmJpdHJhdG9yAAAAAAATAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAHQAAAAAAAAAORXNjcm93Tm90Rm91bmQAAAAAAAEAAAAAAAAAE0VzY3Jvd0FscmVhZHlFeGlzdHMAAAAAAgAAAAAAAAARTWlsZXN0b25lTm90Rm91bmQAAAAAAAADAAAAAAAAABhNaWxlc3RvbmVBbHJlYWR5UmVsZWFzZWQAAAAEAAAAAAAAABJVbmF1dGhvcml6ZWRBY2Nlc3MAAAAAAAUAAAAAAAAAFkludmFsaWRNaWxlc3RvbmVBbW91bnQAAAAAAAYAAAAAAAAAE1RvdGFsQW1vdW50TWlzbWF0Y2gAAAAABwAAAAAAAAATSW5zdWZmaWNpZW50QmFsYW5jZQAAAAAIAAAAAAAAAA9Fc2Nyb3dOb3RBY3RpdmUAAAAACQAAAAAAAAAOVmVjdG9yVG9vTGFyZ2UAAAAAAAoAAAAAAAAAClplcm9BbW91bnQAAAAAAAsAAAAAAAAAD0ludmFsaWREZWFkbGluZQAAAAAMAAAAAAAAAAtTZWxmRGVhbGluZwAAAAANAAAAAAAAABNFc2Nyb3dBbHJlYWR5RnVuZGVkAAAAAA4AAAAAAAAAE1Rva2VuVHJhbnNmZXJGYWlsZWQAAAAADwAAAAAAAAAWVHJlYXN1cnlOb3RJbml0aWFsaXplZAAAAAAAEAAAAAAAAAAXSW52YWxpZEZlZUNvbmZpZ3VyYXRpb24AAAAAEQAAAAAAAAATQWRtaW5Ob3RJbml0aWFsaXplZAAAAAASAAAAAAAAABJBbHJlYWR5SW5pdGlhbGl6ZWQAAAAAABMAAAAAAAAAE0ludmFsaWRFc2Nyb3dTdGF0dXMAAAAAFAAAAAAAAAAQQWxyZWFkeUluRGlzcHV0ZQAAABUAAAAAAAAADUludmFsaWRXaW5uZXIAAAAAAAAWAAAAAAAAAA5Db250cmFjdFBhdXNlZAAAAAAAFwAAAAAAAAASRGVhZGxpbmVOb3RSZWFjaGVkAAAAAAAYAAAAAAAAABZJbnZhbGlkU3RhdHVzRm9yUmVmdW5kAAAAAAAZAAAAAAAAAA9Ob0Z1bmRzVG9SZWZ1bmQAAAAAGgAAAAAAAAAMVW5hdXRob3JpemVkAAAAGwAAAAAAAAAWT3BlcmF0b3JOb3RJbml0aWFsaXplZAAAAAAAHAAAAAAAAAAYQXJiaXRyYXRvck5vdEluaXRpYWxpemVkAAAAHQ==",
        "AAAAAQAAAAAAAAAAAAAABkVzY3JvdwAAAAAADQAAAAAAAAAUY29sbGVjdGVkX3NpZ25hdHVyZXMAAAPqAAAAEwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAAAAAAACm1pbGVzdG9uZXMAAAAAA+oAAAfQAAAACU1pbGVzdG9uZQAAAAAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAATcmVxdWlyZWRfc2lnbmF0dXJlcwAAAAAEAAAAAAAAAApyZXNvbHV0aW9uAAAAAAfQAAAAClJlc29sdXRpb24AAAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAADEVzY3Jvd1N0YXR1cwAAAAAAAAAQdGhyZXNob2xkX2Ftb3VudAAAAAsAAAAAAAAADXRva2VuX2FkZHJlc3MAAAAAAAATAAAAAAAAAAx0b3RhbF9hbW91bnQAAAALAAAAAAAAAA50b3RhbF9yZWxlYXNlZAAAAAAACw==",
        "AAAAAAAAAAAAAAAJZ2V0X3N0YXRlAAAAAAAAAQAAAAAAAAAJZXNjcm93X2lkAAAAAAAABgAAAAEAAAPpAAAH0AAAAAxFc2Nyb3dTdGF0dXMAAAAD",
        "AAAAAAAAAAAAAAAKZ2V0X2NvbmZpZwAAAAAAAAAAAAEAAAPpAAAD7QAAAAIAAAATAAAACwAAAAM=",
        "AAAAAAAAAAAAAAAKZ2V0X2VzY3JvdwAAAAAAAQAAAAAAAAAJZXNjcm93X2lkAAAAAAAABgAAAAEAAAPpAAAH0AAAAAZFc2Nyb3cAAAAAAAM=",
        "AAAAAAAAAAAAAAAKaW5pdGlhbGl6ZQAAAAAAAgAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAAAAAAdmZWVfYnBzAAAAA+gAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAKc2V0X3BhdXNlZAAAAAAAAQAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAKdXBkYXRlX2ZlZQAAAAAAAQAAAAAAAAALbmV3X2ZlZV9icHMAAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAQAAAAAAAAAAAAAACU1pbGVzdG9uZQAAAAAAAAMAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAALZGVzY3JpcHRpb24AAAAAEQAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAD01pbGVzdG9uZVN0YXR1cwA=",
        "AAAAAgAAAAAAAAAAAAAAClJlc29sdXRpb24AAAAAAAQAAAAAAAAAAAAAAAROb25lAAAAAAAAAAAAAAAJRGVwb3NpdG9yAAAAAAAAAAAAAAAAAAAJUmVjaXBpZW50AAAAAAAAAAAAAAAAAAAFU3BsaXQAAAA=",
        "AAAAAAAAAAAAAAANY2FuY2VsX2VzY3JvdwAAAAAAAAEAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAANY3JlYXRlX2VzY3JvdwAAAAAAAAcAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAACWRlcG9zaXRvcgAAAAAAABMAAAAAAAAACXJlY2lwaWVudAAAAAAAABMAAAAAAAAADXRva2VuX2FkZHJlc3MAAAAAAAATAAAAAAAAAAptaWxlc3RvbmVzAAAAAAPqAAAH0AAAAAlNaWxlc3RvbmUAAAAAAAAAAAAACGRlYWRsaW5lAAAABgAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAANZGVwb3NpdF9mdW5kcwAAAAAAAAEAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAANcmFpc2VfZGlzcHV0ZQAAAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAUZTZXQgZmVlIG92ZXJyaWRlIGZvciBhIHNwZWNpZmljIHRva2VuLgpPbmx5IHRyZWFzdXJ5IChhZG1pbikgY2FuIGNhbGwgdGhpcyBmdW5jdGlvbi4KCiMgQXJndW1lbnRzCiogYGVudmAgLSBTb3JvYmFuIGVudmlyb25tZW50IHJlZmVyZW5jZQoqIGB0b2tlbl9hZGRyZXNzYCAtIEFkZHJlc3Mgb2YgdGhlIHRva2VuIHRvIHNldCBmZWUgZm9yCiogYGZlZV9icHNgIC0gRmVlIGluIGJhc2lzIHBvaW50cyAobXVzdCBiZSBpbiByYW5nZSBbMCwgQlBTX0RFTk9NSU5BVE9SXSkKCiMgUmV0dXJucwpPaygoKSkgb24gc3VjY2Vzcywgb3IgRXJyb3IgaWYgdmFsaWRhdGlvbiBmYWlscwAAAAAADXNldF90b2tlbl9mZWUAAAAAAAACAAAAAAAAAA10b2tlbl9hZGRyZXNzAAAAAAAAEwAAAAAAAAAHZmVlX2JwcwAAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAAAAAAAAAAAOcmVmdW5kX2V4cGlyZWQAAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAT9TZXQgZmVlIG92ZXJyaWRlIGZvciBhIHNwZWNpZmljIGVzY3Jvdy4KT25seSB0cmVhc3VyeSAoYWRtaW4pIGNhbiBjYWxsIHRoaXMgZnVuY3Rpb24uCgojIEFyZ3VtZW50cwoqIGBlbnZgIC0gU29yb2JhbiBlbnZpcm9ubWVudCByZWZlcmVuY2UKKiBgZXNjcm93X2lkYCAtIElEIG9mIHRoZSBlc2Nyb3cgdG8gc2V0IGZlZSBmb3IKKiBgZmVlX2Jwc2AgLSBGZWUgaW4gYmFzaXMgcG9pbnRzIChtdXN0IGJlIGluIHJhbmdlIFswLCBCUFNfREVOT01JTkFUT1JdKQoKIyBSZXR1cm5zCk9rKCgpKSBvbiBzdWNjZXNzLCBvciBFcnJvciBpZiB2YWxpZGF0aW9uIGZhaWxzAAAAAA5zZXRfZXNjcm93X2ZlZQAAAAAAAgAAAAAAAAAJZXNjcm93X2lkAAAAAAAABgAAAAAAAAAHZmVlX2JwcwAAAAALAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAgAAAAAAAAAAAAAADEVzY3Jvd1N0YXR1cwAAAAcAAAAAAAAAAAAAAAdDcmVhdGVkAAAAAAAAAAAAAAAABkFjdGl2ZQAAAAAAAAAAAAAAAAAJQ29tcGxldGVkAAAAAAAAAAAAAAAAAAAJQ2FuY2VsbGVkAAAAAAAAAAAAAAAAAAAIRGlzcHV0ZWQAAAAAAAAAAAAAAAhSZXNvbHZlZAAAAAAAAAAAAAAAB0V4cGlyZWQA",
        "AAAAAAAAAAAAAAAPY29tcGxldGVfZXNjcm93AAAAAAEAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAAAAAAAPcmVzb2x2ZV9kaXNwdXRlAAAAAAMAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAABndpbm5lcgAAAAAAEwAAAAAAAAATc3BsaXRfd2lubmVyX2Ftb3VudAAAAAPoAAAACwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAgAAAAAAAAAAAAAADUNvbnRyYWN0U3RhdGUAAAAAAAACAAAAAAAAAAAAAAAGQWN0aXZlAAAAAAAAAAAAAAAAAAZQYXVzZWQAAA==",
        "AAAAAAAAAAAAAAAQY29uZmlybV9kZWxpdmVyeQAAAAMAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAAD21pbGVzdG9uZV9pbmRleAAAAAAEAAAAAAAAAAVidXllcgAAAAAAABMAAAABAAAD6QAAA+0AAAAAAAAAAw==",
        "AAAAAAAAAHRDb2xsZWN0IGEgc2lnbmF0dXJlIGZvciByZWxlYXNpbmcgZnVuZHMKVGhlIHNpZ25hdHVyZSBjYW4gY29tZSBmcm9tIGVpdGhlciB0aGUgZGVwb3NpdG9yIG9yIGEgZGVzaWduYXRlZCB0aGlyZCBwYXJ0eQAAABFjb2xsZWN0X3NpZ25hdHVyZQAAAAAAAAIAAAAAAAAACWVzY3Jvd19pZAAAAAAAAAYAAAAAAAAABnNpZ25lcgAAAAAAEwAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAARcmVsZWFzZV9taWxlc3RvbmUAAAAAAAACAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAGAAAAAAAAAA9taWxlc3RvbmVfaW5kZXgAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAgAAAAAAAAAAAAAAD01pbGVzdG9uZVN0YXR1cwAAAAADAAAAAAAAAAAAAAAHUGVuZGluZwAAAAAAAAAAAAAAAAhSZWxlYXNlZAAAAAAAAAAAAAAACERpc3B1dGVk",
        "AAAAAAAAAG5Db25maWd1cmUgdGhlIHRocmVzaG9sZCBhbW91bnQgYW5kIHJlcXVpcmVkIHNpZ25hdHVyZXMgZm9yIGFuIGVzY3JvdwpPbmx5IHRoZSBkZXBvc2l0b3IgY2FuIGNhbGwgdGhpcyBmdW5jdGlvbgAAAAAAEmNvbmZpZ3VyZV9tdWx0aXNpZwAAAAAAAwAAAAAAAAAJZXNjcm93X2lkAAAAAAAABgAAAAAAAAAQdGhyZXNob2xkX2Ftb3VudAAAAAsAAAAAAAAAE3JlcXVpcmVkX3NpZ25hdHVyZXMAAAAABAAAAAEAAAPpAAAD7QAAAAAAAAAD",
        "AAAAAAAAAAAAAAAUY3JlYXRlX2VzY3Jvd3NfYmF0Y2gAAAABAAAAAAAAAAhyZXF1ZXN0cwAAA+oAAAfQAAAAE0NyZWF0ZUVzY3Jvd1JlcXVlc3QAAAAAAQAAA+kAAAPtAAAAAAAAAAM=",
        "AAAAAQAAAAAAAAAAAAAAE0NyZWF0ZUVzY3Jvd1JlcXVlc3QAAAAABwAAAAAAAAAIZGVhZGxpbmUAAAAGAAAAAAAAAAlkZXBvc2l0b3IAAAAAAAATAAAAAAAAAAllc2Nyb3dfaWQAAAAAAAAGAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAAAAAAACm1pbGVzdG9uZXMAAAAAA+oAAAfQAAAACU1pbGVzdG9uZQAAAAAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAANdG9rZW5fYWRkcmVzcwAAAAAAABM=",
        "AAAAAQAAAAAAAAAAAAAAFkVzY3Jvd0NyZWF0ZWRCYXRjaEl0ZW0AAAAAAAYAAAAAAAAACGRlYWRsaW5lAAAABgAAAAAAAAAJZGVwb3NpdG9yAAAAAAAAEwAAAAAAAAAJZXNjcm93X2lkAAAAAAAABgAAAAAAAAAJcmVjaXBpZW50AAAAAAAAEwAAAAAAAAANdG9rZW5fYWRkcmVzcwAAAAAAABMAAAAAAAAADHRvdGFsX2Ftb3VudAAAAAs=" ]),
      options
    )
  }
  public readonly fromJSON = {
    init: this.txFromJSON<Result<void>>,
        get_state: this.txFromJSON<Result<EscrowStatus>>,
        get_config: this.txFromJSON<Result<readonly [string, i128]>>,
        get_escrow: this.txFromJSON<Result<Escrow>>,
        initialize: this.txFromJSON<Result<void>>,
        set_paused: this.txFromJSON<Result<void>>,
        update_fee: this.txFromJSON<Result<void>>,
        cancel_escrow: this.txFromJSON<Result<void>>,
        create_escrow: this.txFromJSON<Result<void>>,
        deposit_funds: this.txFromJSON<Result<void>>,
        raise_dispute: this.txFromJSON<Result<void>>,
        set_token_fee: this.txFromJSON<Result<void>>,
        refund_expired: this.txFromJSON<Result<void>>,
        set_escrow_fee: this.txFromJSON<Result<void>>,
        complete_escrow: this.txFromJSON<Result<void>>,
        resolve_dispute: this.txFromJSON<Result<void>>,
        confirm_delivery: this.txFromJSON<Result<void>>,
        collect_signature: this.txFromJSON<Result<void>>,
        release_milestone: this.txFromJSON<Result<void>>,
        configure_multisig: this.txFromJSON<Result<void>>,
        create_escrows_batch: this.txFromJSON<Result<void>>
  }
}