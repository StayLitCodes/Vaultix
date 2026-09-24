// lib.rs
#![no_std]
#![allow(unexpected_cfgs)]

mod invariants;

use invariants::{validate_escrow_invariants, validate_status_transition};
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    Symbol, Vec,
};

impl VaultixEscrow {
    /// Secure contract upgrade function (Admin Proxy).
    /// WARNING: Future upgrades MUST preserve storage layout (structs, enums, keys) to avoid corrupting state.
    /// Only admin can call. Emits ContractUpgraded event before upgrade.
    pub fn upgrade(env: Env, new_wasm_hash: [u8; 32]) -> Result<(), Error> {
        let admin = get_admin_internal(&env)?;
        admin.require_auth();

        let hash_bytes = soroban_sdk::BytesN::<32>::from_array(&env, &new_wasm_hash);

        // Emit ContractUpgraded event
        publish_event(
            &env,
            event_topic(&env, "ContractUpgraded"),
            hash_bytes.clone(),
        );

        env.deployer().update_current_contract_wasm(hash_bytes);
        Ok(())
    }
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MilestoneStatus {
    Pending,
    Released,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Milestone {
    pub amount: i128,
    pub status: MilestoneStatus,
    pub description: Symbol,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum EscrowStatus {
    Created,   // Escrow created but funds not yet deposited
    Active,    // Funds deposited and locked in contract
    Completed, // All milestones released
    Cancelled, // Escrow cancelled, funds refunded
    Disputed,
    Resolved,
    Expired, // Escrow expired and refunded to depositor
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Resolution {
    None,
    Depositor,
    Recipient,
    Split,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ContractState {
    Active,
    Paused,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct Escrow {
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub total_amount: i128,
    pub total_released: i128,
    pub milestones: Vec<Milestone>,
    pub status: EscrowStatus,
    pub deadline: u64,
    pub resolution: Resolution,
    pub threshold_amount: i128, // Threshold amount for multi-sig requirement
    pub required_signatures: u32, // Number of signatures required for release
    pub collected_signatures: Vec<Address>, // Addresses that have signed for release
    pub metadata_hash: BytesN<32>, // Raw SHA-256 digest bytes for escrow metadata
    pub funded_amount: i128,    // Actual tokens deposited (0 until deposit_funds succeeds)
    pub approved_signers: Vec<Address>, // Addresses approved to sign for multisig release
}

#[contracttype]
#[derive(Clone, Debug)]
pub(crate) struct EscrowEntryV2 {
    depositor: Address,
    recipient: Address,
    token_address: Address,
    total_amount: i128,
    total_released: i128,
    milestones: Vec<Milestone>,
    packed_state: u32,
    deadline: u64,
    threshold_amount: i128,
    required_signatures: u32,
    collected_signatures: Vec<Address>,
    fee_override_bps: i128,
    metadata_hash: BytesN<32>,
    funded_amount: i128,
    approved_signers: Vec<Address>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct CreateEscrowRequest {
    pub escrow_id: u64,
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub milestones: Vec<Milestone>,
    pub deadline: u64,
    pub metadata_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowCreatedBatchItem {
    pub escrow_id: u64,
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub total_amount: i128,
    pub deadline: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowSummary {
    pub escrow_id: u64,
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub total_amount: i128,
    pub status: EscrowStatus,
    pub deadline: u64,
    pub metadata_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Role {
    Admin,
    Operator,
    Arbitrator,
    Treasury,
}

#[contracttype]
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum FeeScope {
    Global,
    Token,
    Escrow,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct RoleUpdatedEvent {
    pub role: Role,
    pub had_old_address: bool,
    pub old_address: Address,
    pub new_address: Address,
    pub timestamp: u64,
}

/// A pending admin-transfer proposal created by `propose_admin`.
///
/// `expires_at` is a ledger timestamp (`env.ledger().timestamp()`, in seconds)
/// marking the end of the `ADMIN_PROPOSAL_WINDOW_SECS` acceptance window.
#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AdminProposal {
    pub new_admin: Address,
    pub expires_at: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AdminProposedEvent {
    pub caller: Address,
    pub new_admin: Address,
    pub expires_at: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct AdminProposalCancelledEvent {
    pub caller: Address,
    pub new_admin: Address,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FeeUpdatedEvent {
    pub scope: FeeScope,
    pub has_escrow_id: bool,
    pub escrow_id: u64,
    pub has_token_address: bool,
    pub token_address: Address,
    pub old_fee_bps: i128,
    pub new_fee_bps: i128,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct PausedToggledEvent {
    pub paused: bool,
    pub caller: Address,
    pub caller_role: Role,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowCreatedEvent {
    pub escrow_id: u64,
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub total_amount: i128,
    pub total_released: i128,
    pub status: EscrowStatus,
    pub deadline: u64,
    pub metadata_hash: BytesN<32>,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowCreatedBatchEventItem {
    pub escrow_id: u64,
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub total_amount: i128,
    pub total_released: i128,
    pub status: EscrowStatus,
    pub deadline: u64,
    pub metadata_hash: BytesN<32>,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowCreatedBatchEvent {
    pub batch_size: u32,
    pub items: Vec<EscrowCreatedBatchEventItem>,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct FundsDepositedEvent {
    pub escrow_id: u64,
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub total_amount: i128,
    pub status: EscrowStatus,
    pub total_released: i128,
    pub deadline: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct MilestoneReleasedEvent {
    pub escrow_id: u64,
    pub milestone_index: u32,
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub milestone_amount: i128,
    pub payout_amount: i128,
    pub fee_amount: i128,
    pub total_released: i128,
    pub status: EscrowStatus,
    pub total_amount: i128,
    pub deadline: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct DeliveryConfirmedEvent {
    pub escrow_id: u64,
    pub milestone_index: u32,
    pub confirmed_by: Address,
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address,
    pub milestone_amount: i128,
    pub payout_amount: i128,
    pub fee_amount: i128,
    pub total_released: i128,
    pub status: EscrowStatus,
    pub total_amount: i128,
    pub deadline: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct DisputeRaisedEvent {
    pub escrow_id: u64,
    pub raised_by: Address,
    pub depositor: Address,
    pub recipient: Address,
    /// Raw sha2-256 digest of the off-chain evidence bundle backing this dispute.
    pub evidence_hash: BytesN<32>,
    pub status: EscrowStatus,
    pub total_amount: i128,
    pub total_released: i128,
    pub deadline: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct DisputeResolvedEvent {
    pub escrow_id: u64,
    pub winner: Address,
    pub other_party: Address,
    pub winner_amount: i128,
    pub other_amount: i128,
    pub resolution: Resolution,
    /// Raw sha2-256 digest of the arbitrator's resolution evidence, or `None`
    /// when the arbitrator ruled without publishing a supporting document.
    pub resolution_evidence_hash: Option<BytesN<32>>,
    pub status: EscrowStatus,
    pub total_amount: i128,
    pub total_released: i128,
    pub deadline: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowCancelledEvent {
    pub escrow_id: u64,
    pub cancelled_by: Address,
    pub depositor: Address,
    pub token_address: Address,
    pub refund_amount: i128,
    pub fee_amount: i128,
    pub status: EscrowStatus,
    pub total_amount: i128,
    pub total_released: i128,
    pub deadline: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowCompletedEvent {
    pub escrow_id: u64,
    pub completed_by: Address,
    pub total_released: i128,
    pub status: EscrowStatus,
    pub total_amount: i128,
    pub deadline: u64,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowExpiredRefundedEvent {
    pub escrow_id: u64,
    pub refunded_to: Address,
    pub token_address: Address,
    pub refund_amount: i128,
    pub fee_amount: i128,
    pub status: EscrowStatus,
    pub total_amount: i128,
    pub total_released: i128,
    pub deadline: u64,
    pub timestamp: u64,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum Error {
    EscrowNotFound = 1,
    EscrowAlreadyExists = 2,
    MilestoneNotFound = 3,
    MilestoneAlreadyReleased = 4,
    UnauthorizedAccess = 5,
    InvalidMilestoneAmount = 6,
    TotalAmountMismatch = 7,
    InsufficientBalance = 8,
    EscrowNotActive = 9,
    VectorTooLarge = 10,
    ZeroAmount = 11,
    InvalidDeadline = 12,
    SelfDealing = 13,
    EscrowAlreadyFunded = 14,
    TokenTransferFailed = 15,
    TreasuryNotInitialized = 16,
    InvalidFeeConfiguration = 17,
    AdminNotInitialized = 18,
    AlreadyInitialized = 19,
    InvalidEscrowStatus = 20,
    AlreadyInDispute = 21,
    InvalidWinner = 22,
    ContractPaused = 23,
    DeadlineNotReached = 24,
    InvalidStatusForRefund = 25,
    NoFundsToRefund = 26,
    Unauthorized = 27,
    OperatorNotInitialized = 28,
    ArbitratorNotInitialized = 29,
    InvalidMetadataHash = 30,
    UnsupportedEscrowVersion = 31,
    DisputeEvidenceNotFound = 32,
    AdminProposalNotFound = 33,
    AdminProposalExpired = 34,
    InvalidAdminProposal = 35,
    ContractNotInitialized = 36,
    InvalidSignerConfiguration = 37,
}

const DEFAULT_FEE_BPS: i128 = 50;
const BPS_DENOMINATOR: i128 = 10000;
/// Ledger-seconds window that a pending admin proposal remains acceptable.
///
/// A proposal created by `propose_admin` can only be accepted by the pending
/// admin within this window; once it elapses the proposal expires and the
/// current admin remains in force. See "Admin Transfer (Two-Step Handshake)"
/// in `docs/contract/README.md` for the full flow.
const ADMIN_PROPOSAL_WINDOW_SECS: u64 = 7 * 24 * 60 * 60; // 7 days
const MAX_BATCH_SIZE: u32 = 20;
/// Minimum number of seconds a deadline must be in the future at creation time.
/// Prevents escrows that expire within the same ledger or within a trivially short window.
const MIN_DEADLINE_LEAD_SECS: u64 = 60;
const ESCROW_ENTRY_STORAGE_VERSION: i128 = 2;
const EVENT_NAMESPACE: &str = "Vaultix";
const EVENT_SCHEMA_VERSION: &str = "v1";
const MAX_PAGE_SIZE: u32 = 100;
/// Number of escrow ids stored per party-index chunk.
///
/// Matching `MAX_PAGE_SIZE` guarantees any requested page spans at most two
/// chunks, so `list_escrows_by_party` never loads more than two bounded entries.
const PARTY_INDEX_CHUNK_SIZE: u32 = 100;
/// TTL bump threshold / target applied to party-index entries that are touched.
const PARTY_INDEX_TTL_THRESHOLD: u32 = 100;
const PARTY_INDEX_TTL_EXTEND_TO: u32 = 1_000_000;

#[derive(Clone, Debug)]
struct ReleaseOutcome {
    milestone_amount: i128,
    payout_amount: i128,
    fee_amount: i128,
    total_released: i128,
}

#[contract]
pub struct VaultixEscrow;

#[contractimpl]
impl VaultixEscrow {
    /// Atomic constructor — runs exactly once at deploy time.
    ///
    /// Sets all roles (admin, operator, arbitrator, treasury) and the global
    /// fee in a single transaction, eliminating the permissionless-initializer
    /// window that existed with the old `init()` / `initialize()` pair.
    ///
    /// BREAKING CHANGE (issue #621): replaces `init()` and `initialize()`.
    pub fn __constructor(
        env: Env,
        admin: Address,
        operator: Address,
        arbitrator: Address,
        treasury: Address,
        fee_bps: Option<i128>,
    ) {
        let fee = fee_bps.unwrap_or(DEFAULT_FEE_BPS);
        assert!(
            (0..=BPS_DENOMINATOR).contains(&fee),
            "fee_bps must be in [0, 10000]"
        );

        env.storage().persistent().set(&admin_storage_key(), &admin);
        env.storage()
            .persistent()
            .set(&operator_storage_key(), &operator);
        env.storage()
            .persistent()
            .set(&arbitrator_storage_key(), &arbitrator);
        env.storage()
            .instance()
            .set(&symbol_short!("treasury"), &treasury);
        env.storage()
            .instance()
            .set(&symbol_short!("fee_bps"), &fee);
        env.storage().instance().set(&symbol_short!("init"), &true);
        extend_roles_ttl(&env);

        let timestamp = current_timestamp(&env);

        emit_role_updated(&env, Role::Admin, None, admin, timestamp);
        emit_role_updated(&env, Role::Operator, None, operator, timestamp);
        emit_role_updated(&env, Role::Arbitrator, None, arbitrator, timestamp);
        emit_role_updated(&env, Role::Treasury, None, treasury.clone(), timestamp);

        publish_event(
            &env,
            event_topic(&env, "FeeUpdated"),
            FeeUpdatedEvent {
                scope: FeeScope::Global,
                has_escrow_id: false,
                escrow_id: 0,
                has_token_address: false,
                token_address: treasury.clone(),
                old_fee_bps: 0,
                new_fee_bps: fee,
                timestamp,
            },
        );
    }

    /// Returns `true` once the contract has been fully initialized via the
    /// constructor. Deploy workflows (issue #575) can call this as a smoke
    /// check.
    pub fn is_initialized(env: Env) -> bool {
        env.storage().instance().has(&symbol_short!("init"))
    }

    pub fn update_fee(env: Env, new_fee_bps: i128) -> Result<(), Error> {
        let operator = get_operator_internal(&env)?;
        operator.require_auth();

        if !(0..=BPS_DENOMINATOR).contains(&new_fee_bps) {
            return Err(Error::InvalidFeeConfiguration);
        }

        let old_fee: i128 = env
            .storage()
            .instance()
            .get(&symbol_short!("fee_bps"))
            .unwrap_or(DEFAULT_FEE_BPS);

        env.storage()
            .instance()
            .set(&symbol_short!("fee_bps"), &new_fee_bps);

        publish_event(
            &env,
            event_topic(&env, "FeeUpdated"),
            FeeUpdatedEvent {
                scope: FeeScope::Global,
                has_escrow_id: false,
                escrow_id: 0,
                has_token_address: false,
                token_address: operator.clone(),
                old_fee_bps: old_fee,
                new_fee_bps,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    /// Set fee override for a specific token.
    /// Only treasury (admin) can call this function.
    ///
    /// # Arguments
    /// * `env` - Soroban environment reference
    /// * `token_address` - Address of the token to set fee for
    /// * `fee_bps` - Fee in basis points (must be in range [0, BPS_DENOMINATOR])
    ///
    /// # Returns
    /// Ok(()) on success, or Error if validation fails
    pub fn set_token_fee(env: Env, token_address: Address, fee_bps: i128) -> Result<(), Error> {
        let treasury: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("treasury"))
            .ok_or(Error::TreasuryNotInitialized)?;
        treasury.require_auth();

        if !(0..=BPS_DENOMINATOR).contains(&fee_bps) {
            return Err(Error::InvalidFeeConfiguration);
        }

        let token_fee_key = get_token_fee_key(&token_address);
        let old_fee: Option<i128> = env.storage().persistent().get(&token_fee_key);

        env.storage().persistent().set(&token_fee_key, &fee_bps);
        env.storage()
            .persistent()
            .extend_ttl(&token_fee_key, 100, 2_000_000);

        publish_event(
            &env,
            event_topic(&env, "FeeUpdated"),
            FeeUpdatedEvent {
                scope: FeeScope::Token,
                has_escrow_id: false,
                escrow_id: 0,
                has_token_address: true,
                token_address,
                old_fee_bps: old_fee.unwrap_or(DEFAULT_FEE_BPS),
                new_fee_bps: fee_bps,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    /// Set fee override for a specific escrow.
    /// Only treasury (admin) can call this function.
    ///
    /// # Arguments
    /// * `env` - Soroban environment reference
    /// * `escrow_id` - ID of the escrow to set fee for
    /// * `fee_bps` - Fee in basis points (must be in range [0, BPS_DENOMINATOR])
    ///
    /// # Returns
    /// Ok(()) on success, or Error if validation fails
    pub fn set_escrow_fee(env: Env, escrow_id: u64, fee_bps: i128) -> Result<(), Error> {
        let treasury: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("treasury"))
            .ok_or(Error::TreasuryNotInitialized)?;
        treasury.require_auth();

        if !(0..=BPS_DENOMINATOR).contains(&fee_bps) {
            return Err(Error::InvalidFeeConfiguration);
        }

        if let Ok(mut escrow) = load_escrow_entry_v2(&env, escrow_id) {
            let old_fee = escrow_fee_override_opt(&escrow).unwrap_or(DEFAULT_FEE_BPS);
            escrow.fee_override_bps = fee_bps;
            store_escrow_entry_v2(&env, escrow_id, &escrow)?;

            publish_event(
                &env,
                event_topic(&env, "FeeUpdated"),
                FeeUpdatedEvent {
                    scope: FeeScope::Escrow,
                    has_escrow_id: true,
                    escrow_id,
                    has_token_address: false,
                    token_address: escrow.token_address.clone(),
                    old_fee_bps: old_fee,
                    new_fee_bps: fee_bps,
                    timestamp: current_timestamp(&env),
                },
            );

            return Ok(());
        }

        let escrow_fee_key = get_escrow_fee_key(escrow_id);
        let old_fee: Option<i128> = env.storage().persistent().get(&escrow_fee_key);

        env.storage().persistent().set(&escrow_fee_key, &fee_bps);
        env.storage()
            .persistent()
            .extend_ttl(&escrow_fee_key, 100, 500_000);

        publish_event(
            &env,
            event_topic(&env, "FeeUpdated"),
            FeeUpdatedEvent {
                scope: FeeScope::Escrow,
                has_escrow_id: true,
                escrow_id,
                has_token_address: false,
                token_address: treasury.clone(),
                old_fee_bps: old_fee.unwrap_or(DEFAULT_FEE_BPS),
                new_fee_bps: fee_bps,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn get_config(env: Env) -> Result<(Address, i128), Error> {
        let treasury: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("treasury"))
            .ok_or(Error::TreasuryNotInitialized)?;
        let fee_bps: i128 = env
            .storage()
            .instance()
            .get(&symbol_short!("fee_bps"))
            .unwrap_or(DEFAULT_FEE_BPS);
        Ok((treasury, fee_bps))
    }

    pub fn set_paused(env: Env, paused: bool) -> Result<(), Error> {
        let operator = get_operator_internal(&env)?;
        operator.require_auth();

        let state = if paused {
            ContractState::Paused
        } else {
            ContractState::Active
        };
        env.storage()
            .instance()
            .set(&symbol_short!("state"), &state);

        publish_event(
            &env,
            event_topic(&env, "PausedToggled"),
            PausedToggledEvent {
                paused,
                caller: operator,
                caller_role: Role::Operator,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn get_admin(env: Env) -> Result<Address, Error> {
        let admin = get_admin_internal(&env)?;
        Ok(admin)
    }

    pub fn get_operator(env: Env) -> Result<Address, Error> {
        let operator = get_operator_internal(&env)?;
        Ok(operator)
    }

    pub fn get_arbitrator(env: Env) -> Result<Address, Error> {
        let arbitrator = get_arbitrator_internal(&env)?;
        Ok(arbitrator)
    }

    pub fn get_treasury(env: Env) -> Result<Address, Error> {
        let treasury = get_treasury_internal(&env)?;
        Ok(treasury)
    }

    /// Propose a new admin as part of the two-step admin transfer handshake.
    ///
    /// Only the current admin may propose. The current admin stays in force
    /// until the pending admin proves control of their key by calling
    /// `accept_admin`. Proposing again replaces any existing pending proposal
    /// and restarts its expiry window. Emits an `AdminProposed` event.
    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        let current_admin = get_admin_internal(&env)?;
        current_admin.require_auth();

        if new_admin == current_admin {
            return Err(Error::InvalidAdminProposal);
        }

        let timestamp = current_timestamp(&env);

        let proposal = AdminProposal {
            new_admin: new_admin.clone(),
            expires_at: timestamp.saturating_add(ADMIN_PROPOSAL_WINDOW_SECS),
        };

        env.storage()
            .persistent()
            .set(&admin_proposal_storage_key(), &proposal);
        extend_admin_proposal_ttl(&env);

        publish_event(
            &env,
            event_topic(&env, "AdminProposed"),
            AdminProposedEvent {
                caller: current_admin,
                new_admin,
                expires_at: proposal.expires_at,
                timestamp,
            },
        );

        Ok(())
    }

    /// Complete a pending admin transfer.
    ///
    /// Only the pending admin themselves can accept; this proves control of the
    /// key and immediately promotes them, emitting the existing `RoleUpdated`
    /// event. A proposal can only be accepted within `ADMIN_PROPOSAL_WINDOW_SECS`
    /// of being proposed; once that window passes the proposal is inert — it
    /// can never be accepted — and the current admin remains in force until it
    /// is withdrawn via `cancel_admin_proposal` or replaced by a new proposal.
    pub fn accept_admin(env: Env) -> Result<(), Error> {
        let proposal = load_admin_proposal(&env)?;
        let timestamp = current_timestamp(&env);

        if timestamp > proposal.expires_at {
            // An expired proposal can never complete the handshake. (Storage
            // writes are reverted when a contract returns an error, so the
            // stale entry stays in place, inert, until the admin cancels it or
            // proposes again.)
            return Err(Error::AdminProposalExpired);
        }

        proposal.new_admin.require_auth();

        let current_admin = get_admin_internal(&env)?;

        env.storage()
            .persistent()
            .set(&admin_storage_key(), &proposal.new_admin);
        env.storage()
            .persistent()
            .remove(&admin_proposal_storage_key());
        extend_roles_ttl(&env);
        emit_role_updated(
            &env,
            Role::Admin,
            Some(current_admin),
            proposal.new_admin,
            timestamp,
        );

        Ok(())
    }

    /// Withdraw a pending admin proposal. Only the current admin may cancel.
    /// Emits an `AdminProposalCancelled` event.
    pub fn cancel_admin_proposal(env: Env) -> Result<(), Error> {
        let current_admin = get_admin_internal(&env)?;
        current_admin.require_auth();

        let proposal = load_admin_proposal(&env)?;

        env.storage()
            .persistent()
            .remove(&admin_proposal_storage_key());

        publish_event(
            &env,
            event_topic(&env, "AdminProposalCancelled"),
            AdminProposalCancelledEvent {
                caller: current_admin,
                new_admin: proposal.new_admin,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    /// Returns the currently pending admin proposal, if any.
    ///
    /// The returned `expires_at` is a ledger timestamp; a proposal whose window
    /// has elapsed can no longer be accepted.
    pub fn get_pending_admin(env: Env) -> Option<AdminProposal> {
        let proposal: Option<AdminProposal> = env
            .storage()
            .persistent()
            .get(&admin_proposal_storage_key());
        if proposal.is_some() {
            extend_admin_proposal_ttl(&env);
        }
        proposal
    }

    /// BREAKING CHANGE (issue #570): two-step admin transfer.
    ///
    /// This no longer transfers the admin role immediately. It now delegates to
    /// `propose_admin`, so the address is only stored as a *pending* proposal
    /// and the current admin stays in force until that address proves control of
    /// its key by calling `accept_admin`. Kept as a compatibility shim for
    /// existing callers; new integrations should call `propose_admin` directly.
    pub fn set_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        Self::propose_admin(env, new_admin)
    }

    pub fn set_operator(env: Env, new_operator: Address) -> Result<(), Error> {
        let admin = get_admin_internal(&env)?;
        admin.require_auth();

        let old_operator = get_operator_internal(&env).ok();

        let timestamp = current_timestamp(&env);

        env.storage()
            .persistent()
            .set(&operator_storage_key(), &new_operator);
        extend_roles_ttl(&env);
        emit_role_updated(&env, Role::Operator, old_operator, new_operator, timestamp);

        Ok(())
    }

    pub fn set_arbitrator(env: Env, new_arbitrator: Address) -> Result<(), Error> {
        let admin = get_admin_internal(&env)?;
        admin.require_auth();

        let old_arbitrator = get_arbitrator_internal(&env).ok();

        let timestamp = current_timestamp(&env);

        env.storage()
            .persistent()
            .set(&arbitrator_storage_key(), &new_arbitrator);
        extend_roles_ttl(&env);
        emit_role_updated(
            &env,
            Role::Arbitrator,
            old_arbitrator,
            new_arbitrator,
            timestamp,
        );

        Ok(())
    }

    pub fn set_treasury(env: Env, new_treasury: Address) -> Result<(), Error> {
        let admin = get_admin_internal(&env)?;
        admin.require_auth();

        let old_treasury = get_treasury_internal(&env).ok();

        let timestamp = current_timestamp(&env);

        env.storage()
            .instance()
            .set(&symbol_short!("treasury"), &new_treasury);

        emit_role_updated(&env, Role::Treasury, old_treasury, new_treasury, timestamp);

        Ok(())
    }

    // init() and initialize() removed — replaced by __constructor (issue #621).

    /// Test-only helper: set a legacy `Escrow` record and optional escrow fee directly into persistent storage.
    /// Compiled only for test builds to avoid exposing in production.
    #[cfg(test)]
    pub fn test_set_legacy_escrow(
        env: Env,
        escrow_id: u64,
        legacy: Escrow,
        fee_bps: Option<i128>,
    ) -> Result<(), Error> {
        // Write legacy escrow under the legacy key within contract execution context
        env.storage()
            .persistent()
            .set(&get_storage_key_legacy(escrow_id), &legacy);
        if let Some(f) = fee_bps {
            env.storage()
                .persistent()
                .set(&get_escrow_fee_key(escrow_id), &f);
        }
        Ok(())
    }

    /// Test-only helper: write a legacy (pre-chunking) single-vector party index
    /// under the old `depidx`/`recidx` key so migration can be exercised.
    #[cfg(test)]
    pub fn test_set_legacy_party_index(env: Env, party: Address, role: Symbol, ids: Vec<u64>) {
        let key = if role == symbol_short!("depositor") {
            get_depositor_index_key(&party)
        } else {
            get_recipient_index_key(&party)
        };
        env.storage().persistent().set(&key, &ids);
    }

    /// Test-only helper: does the legacy party index key still exist?
    #[cfg(test)]
    pub fn test_has_legacy_party_index(env: Env, party: Address, role: Symbol) -> bool {
        let key = if role == symbol_short!("depositor") {
            get_depositor_index_key(&party)
        } else {
            get_recipient_index_key(&party)
        };
        env.storage().persistent().has(&key)
    }

    /// Test-only helper: number of ids stored in a single party-index chunk.
    #[cfg(test)]
    pub fn test_party_index_chunk_len(env: Env, party: Address, role: Symbol, chunk: u32) -> u32 {
        let index_role = if role == symbol_short!("depositor") {
            PartyIndexRole::Depositor
        } else {
            PartyIndexRole::Recipient
        };
        env.storage()
            .persistent()
            .get::<(Symbol, Address, u32), Vec<u64>>(&party_index_chunk_key(
                index_role, &party, chunk,
            ))
            .map(|c| c.len())
            .unwrap_or(0)
    }

    #[cfg(test)]
    pub fn test_has_escrow_v2(env: Env, escrow_id: u64) -> bool {
        env.storage()
            .persistent()
            .has(&get_storage_key_v2(escrow_id))
    }

    #[cfg(test)]
    pub fn test_has_legacy_escrow(env: Env, escrow_id: u64) -> bool {
        env.storage()
            .persistent()
            .has(&get_storage_key_legacy(escrow_id))
    }

    #[cfg(test)]
    pub fn test_get_escrow_version(env: Env, escrow_id: u64) -> i128 {
        env.storage()
            .persistent()
            .get::<(Symbol, u64), i128>(&get_escrow_version_key(escrow_id))
            .unwrap_or(0)
    }

    /// Test-only: validate escrow invariants without persisting state.
    #[cfg(test)]
    #[allow(private_interfaces)]
    pub fn test_validate_escrow_invariants(escrow: EscrowEntryV2) -> Result<(), Error> {
        validate_escrow_invariants(&escrow)
    }

    /// Test-only: validate a status transition without mutating state.
    #[cfg(test)]
    #[allow(private_interfaces)]
    pub fn test_validate_status_transition(
        from: EscrowStatus,
        to: EscrowStatus,
    ) -> Result<(), Error> {
        validate_status_transition(from, to)
    }

    /// Test-only: persist a V2 escrow entry without invariant checks (corrupt state setup).
    #[cfg(test)]
    #[allow(private_interfaces)]
    pub fn test_store_escrow_raw(env: Env, escrow_id: u64, escrow: EscrowEntryV2) {
        let key = get_storage_key_v2(escrow_id);
        env.storage().persistent().set(&key, &escrow);
        set_escrow_entry_version(&env, escrow_id, ESCROW_ENTRY_STORAGE_VERSION);
    }

    /// Test-only: build a V2 escrow entry from the public escrow view.
    #[cfg(test)]
    #[allow(private_interfaces)]
    pub fn test_escrow_entry_from_public(escrow: Escrow) -> EscrowEntryV2 {
        EscrowEntryV2 {
            depositor: escrow.depositor,
            recipient: escrow.recipient,
            token_address: escrow.token_address,
            total_amount: escrow.total_amount,
            total_released: escrow.total_released,
            milestones: escrow.milestones,
            packed_state: pack_escrow_state(escrow.status, escrow.resolution),
            deadline: escrow.deadline,
            threshold_amount: escrow.threshold_amount,
            required_signatures: escrow.required_signatures,
            collected_signatures: escrow.collected_signatures,
            fee_override_bps: -1,
            metadata_hash: escrow.metadata_hash,
            funded_amount: escrow.funded_amount,
            approved_signers: escrow.approved_signers,
        }
    }

    /// Configure the threshold amount, required signatures, and approved signer
    /// set for an escrow. Only the depositor can call this function.
    ///
    /// BREAKING CHANGE (issue #622): now requires an explicit `signers` list.
    pub fn configure_multisig(
        env: Env,
        escrow_id: u64,
        threshold_amount: i128,
        required_signatures: u32,
        signers: Vec<Address>,
    ) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        escrow.depositor.require_auth();

        // Only allow configuration if the escrow hasn't been funded yet
        if escrow_status(&escrow) != EscrowStatus::Created {
            return Err(Error::InvalidEscrowStatus);
        }

        if threshold_amount < 0 {
            return Err(Error::InvalidSignerConfiguration);
        }
        if required_signatures == 0 {
            return Err(Error::InvalidSignerConfiguration);
        }
        if required_signatures > signers.len() {
            return Err(Error::InvalidSignerConfiguration);
        }

        escrow.threshold_amount = threshold_amount;
        escrow.required_signatures = required_signatures;
        escrow.approved_signers = signers;

        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        // Emit event
        publish_event(
            &env,
            event_topic(&env, "MultisigConfigured"),
            (escrow_id, threshold_amount, required_signatures),
        );

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_escrow(
        env: Env,
        escrow_id: u64,
        depositor: Address,
        recipient: Address,
        token_address: Address,
        milestones: Vec<Milestone>,
        deadline: u64,
        metadata_hash: BytesN<32>,
    ) -> Result<(), Error> {
        ensure_initialized(&env)?;
        depositor.require_auth();
        ensure_not_paused(&env)?;

        if depositor == recipient {
            return Err(Error::SelfDealing);
        }

        // Deadline must be strictly in the future with minimum lead time (#623)
        let now = env.ledger().timestamp();
        if deadline <= now.saturating_add(MIN_DEADLINE_LEAD_SECS) {
            return Err(Error::InvalidDeadline);
        }

        validate_hash(&metadata_hash)?;

        if env
            .storage()
            .persistent()
            .has(&get_storage_key_legacy(escrow_id))
            || env
                .storage()
                .persistent()
                .has(&get_storage_key_v2(escrow_id))
        {
            return Err(Error::EscrowAlreadyExists);
        }

        let total_amount = validate_milestones(&milestones)?;

        let mut initialized_milestones = Vec::new(&env);
        for milestone in milestones.iter() {
            let mut m = milestone.clone();
            m.status = MilestoneStatus::Pending;
            initialized_milestones.push_back(m);
        }

        let fee_override_bps = env
            .storage()
            .persistent()
            .get::<(Symbol, u64), i128>(&get_escrow_fee_key(escrow_id))
            .unwrap_or(-1);
        if fee_override_bps >= 0 {
            env.storage()
                .persistent()
                .remove(&get_escrow_fee_key(escrow_id));
        }

        let escrow = EscrowEntryV2 {
            depositor: depositor.clone(),
            recipient: recipient.clone(),
            token_address: token_address.clone(),
            total_amount,
            total_released: 0,
            milestones: initialized_milestones,
            packed_state: pack_escrow_state(EscrowStatus::Created, Resolution::None),
            deadline,
            threshold_amount: i128::MAX, // safe default: all milestones take depositor-auth path
            required_signatures: 1,
            collected_signatures: Vec::new(&env),
            fee_override_bps,
            metadata_hash: metadata_hash.clone(),
            funded_amount: 0,
            approved_signers: Vec::new(&env),
        };

        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        // Add to depositor / recipient indexes (O(1): touches one chunk each)
        party_index_append(&env, PartyIndexRole::Depositor, &depositor, escrow_id);
        party_index_append(&env, PartyIndexRole::Recipient, &recipient, escrow_id);

        publish_event(
            &env,
            event_topic(&env, "EscrowCreated"),
            EscrowCreatedEvent {
                escrow_id,
                depositor,
                recipient,
                token_address,
                total_amount,
                total_released: 0,
                status: EscrowStatus::Created,
                deadline,
                metadata_hash,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn create_escrows_batch(env: Env, requests: Vec<CreateEscrowRequest>) -> Result<(), Error> {
        ensure_initialized(&env)?;
        ensure_not_paused(&env)?;

        if requests.len() > MAX_BATCH_SIZE {
            return Err(Error::VectorTooLarge);
        }

        let now = env.ledger().timestamp();

        let mut created_items: Vec<EscrowCreatedBatchEventItem> = Vec::new(&env);
        let mut pending_entries: Vec<(u64, EscrowEntryV2, bool)> = Vec::new(&env);
        let mut escrow_ids: Vec<u64> = Vec::new(&env);
        let mut authed: Vec<Address> = Vec::new(&env);

        for request in requests.iter() {
            let escrow_id = request.escrow_id;
            let depositor = request.depositor.clone();
            let recipient = request.recipient.clone();
            let token_address = request.token_address.clone();
            let milestones = request.milestones.clone();
            let deadline = request.deadline;
            let metadata_hash = request.metadata_hash.clone();

            if depositor == recipient {
                return Err(Error::SelfDealing);
            }

            // Deadline must be strictly in the future with minimum lead time (#623)
            if deadline <= now.saturating_add(MIN_DEADLINE_LEAD_SECS) {
                return Err(Error::InvalidDeadline);
            }

            validate_hash(&metadata_hash)?;

            for existing_id in escrow_ids.iter() {
                if existing_id == escrow_id {
                    return Err(Error::EscrowAlreadyExists);
                }
            }
            escrow_ids.push_back(escrow_id);

            if env
                .storage()
                .persistent()
                .has(&get_storage_key_legacy(escrow_id))
                || env
                    .storage()
                    .persistent()
                    .has(&get_storage_key_v2(escrow_id))
            {
                return Err(Error::EscrowAlreadyExists);
            }

            let mut already_authed = false;
            for a in authed.iter() {
                if a == depositor {
                    already_authed = true;
                    break;
                }
            }
            if !already_authed {
                depositor.require_auth();
                authed.push_back(depositor.clone());
            }

            let total_amount = validate_milestones(&milestones)?;

            let mut initialized_milestones = Vec::new(&env);
            for milestone in milestones.iter() {
                let mut m = milestone.clone();
                m.status = MilestoneStatus::Pending;
                initialized_milestones.push_back(m);
            }

            let fee_override_bps = env
                .storage()
                .persistent()
                .get::<(Symbol, u64), i128>(&get_escrow_fee_key(escrow_id))
                .unwrap_or(-1);

            let escrow = EscrowEntryV2 {
                depositor: depositor.clone(),
                recipient: recipient.clone(),
                token_address: token_address.clone(),
                total_amount,
                total_released: 0,
                milestones: initialized_milestones,
                packed_state: pack_escrow_state(EscrowStatus::Created, Resolution::None),
                deadline,
                threshold_amount: i128::MAX,
                required_signatures: 1,
                collected_signatures: Vec::new(&env),
                fee_override_bps,
                metadata_hash,
                funded_amount: 0,
                approved_signers: Vec::new(&env),
            };

            pending_entries.push_back((escrow_id, escrow, fee_override_bps >= 0));

            created_items.push_back(EscrowCreatedBatchEventItem {
                escrow_id,
                depositor,
                recipient,
                token_address,
                total_amount,
                total_released: 0,
                status: EscrowStatus::Created,
                deadline,
                metadata_hash: request.metadata_hash.clone(),
            });
        }

        for pending in pending_entries.iter() {
            let escrow_id = pending.0;
            let escrow = pending.1.clone();
            let has_fee_key = pending.2;

            if has_fee_key {
                env.storage()
                    .persistent()
                    .remove(&get_escrow_fee_key(escrow_id));
            }

            store_escrow_entry_v2(&env, escrow_id, &escrow)?;

            // Add to depositor / recipient indexes (O(1): touches one chunk each)
            party_index_append(
                &env,
                PartyIndexRole::Depositor,
                &escrow.depositor,
                escrow_id,
            );
            party_index_append(
                &env,
                PartyIndexRole::Recipient,
                &escrow.recipient,
                escrow_id,
            );
        }

        if !created_items.is_empty() {
            publish_event(
                &env,
                event_topic(&env, "EscrowCreatedBatch"),
                EscrowCreatedBatchEvent {
                    batch_size: created_items.len(),
                    items: created_items,
                    timestamp: current_timestamp(&env),
                },
            );
        }

        Ok(())
    }

    pub fn deposit_funds(env: Env, escrow_id: u64) -> Result<(), Error> {
        ensure_initialized(&env)?;
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;
        escrow.depositor.require_auth();

        if escrow_status(&escrow) != EscrowStatus::Created {
            return Err(Error::EscrowAlreadyFunded);
        }

        let token_client = token::Client::new(&env, &escrow.token_address);
        // Defensive checks to avoid host traps when the token contract would trap
        // on transfer_from due to missing allowance or insufficient balance.
        // Check depositor balance first.
        let depositor_balance = token_client.balance(&escrow.depositor);
        if depositor_balance < escrow.total_amount {
            return Err(Error::InsufficientBalance);
        }

        // Check allowance granted to this contract (spender) by the depositor.
        // If allowance is insufficient, return a TokenTransferFailed error instead
        // of invoking transfer_from which would trap the host.
        let spender = env.current_contract_address();
        let allowance = token_client.allowance(&escrow.depositor, &spender);
        if allowance < escrow.total_amount {
            return Err(Error::TokenTransferFailed);
        }

        // Safe to call transfer_from now that basic preconditions hold.
        token_client.transfer_from(&spender, &escrow.depositor, &spender, &escrow.total_amount);

        // Record the actual deposited amount so payouts never exceed funds on hand (#620)
        escrow.funded_amount = escrow.total_amount;

        set_escrow_status(&mut escrow, EscrowStatus::Active)?;
        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        publish_event(
            &env,
            event_topic(&env, "FundsDeposited"),
            FundsDepositedEvent {
                escrow_id,
                depositor: escrow.depositor.clone(),
                recipient: escrow.recipient.clone(),
                token_address: escrow.token_address.clone(),
                total_amount: escrow.total_amount,
                status: escrow_status(&escrow),
                total_released: escrow.total_released,
                deadline: escrow.deadline,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    /// Collect a signature for releasing funds.
    ///
    /// Only addresses in the escrow's `approved_signers` set (configured via
    /// `configure_multisig`) are accepted. An arbitrary third party that is not
    /// in the approved set is rejected with `UnauthorizedAccess` (#622).
    pub fn collect_signature(env: Env, escrow_id: u64, signer: Address) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        // Require authentication from the signer
        signer.require_auth();

        // Verify signer is in the approved set (#622)
        let mut approved = false;
        for s in escrow.approved_signers.iter() {
            if s == signer {
                approved = true;
                break;
            }
        }
        if !approved {
            return Err(Error::UnauthorizedAccess);
        }

        // Check if this signer has already signed
        for existing_signer in escrow.collected_signatures.iter() {
            if existing_signer == signer {
                return Ok(()); // Idempotent - no error if already signed
            }
        }

        // Add the new signature
        escrow.collected_signatures.push_back(signer.clone());

        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        // Emit event
        publish_event(
            &env,
            event_topic(&env, "SignatureCollected"),
            (escrow_id, signer),
        );

        Ok(())
    }

    /// Returns the evidence digest recorded when the dispute was raised.
    ///
    /// Errors with `EscrowNotFound` when the escrow id is unknown, and with
    /// `DisputeEvidenceNotFound` when the escrow exists but no dispute was ever
    /// raised against it (or it predates evidence recording).
    pub fn get_dispute_evidence(env: Env, escrow_id: u64) -> Result<BytesN<32>, Error> {
        let escrow = load_escrow_entry_v2(&env, escrow_id)?;

        let key = get_dispute_evidence_key(escrow_id);
        let evidence_hash = env
            .storage()
            .persistent()
            .get::<(Symbol, u64), BytesN<32>>(&key)
            .ok_or(Error::DisputeEvidenceNotFound)?;
        extend_escrow_ttl(&env, &key, &escrow);

        Ok(evidence_hash)
    }

    /// Returns the arbitrator's resolution evidence digest, if one was supplied.
    ///
    /// `Ok(None)` means the dispute was resolved without resolution evidence
    /// (or is not resolved yet); `EscrowNotFound` means the id is unknown.
    pub fn get_dispute_resolution_evidence(
        env: Env,
        escrow_id: u64,
    ) -> Result<Option<BytesN<32>>, Error> {
        let escrow = load_escrow_entry_v2(&env, escrow_id)?;

        let key = get_dispute_resolution_evidence_key(escrow_id);
        let evidence_hash = env
            .storage()
            .persistent()
            .get::<(Symbol, u64), BytesN<32>>(&key);
        if evidence_hash.is_some() {
            extend_escrow_ttl(&env, &key, &escrow);
        }

        Ok(evidence_hash)
    }

    pub fn get_escrow(env: Env, escrow_id: u64) -> Result<Escrow, Error> {
        let escrow = load_escrow_entry_v2(&env, escrow_id)?;
        Ok(escrow_entry_to_public(escrow))
    }

    /// List escrows by party address (depositor or recipient) with pagination
    ///
    /// # Arguments
    /// * `env` - Soroban environment reference
    /// * `party` - Address to query (either depositor or recipient)
    /// * `role` - "depositor" or "recipient" to specify which index to query
    /// * `page` - Page number (0-indexed)
    /// * `page_size` - Number of results per page (max MAX_PAGE_SIZE)
    ///
    /// # Returns
    /// Vec<EscrowSummary> - Lightweight escrow summaries for the page
    pub fn list_escrows_by_party(
        env: Env,
        party: Address,
        role: Symbol,
        page: u32,
        page_size: u32,
    ) -> Result<Vec<EscrowSummary>, Error> {
        // Enforce page size limit
        if page_size == 0 || page_size > MAX_PAGE_SIZE {
            return Err(Error::VectorTooLarge);
        }

        // Get the appropriate index based on role
        let index_role = if role == symbol_short!("depositor") {
            PartyIndexRole::Depositor
        } else if role == symbol_short!("recipient") {
            PartyIndexRole::Recipient
        } else {
            return Err(Error::Unauthorized);
        };

        // Total indexed ids for this party (O(1); migrates legacy index if needed)
        let total = party_index_total(&env, index_role, &party);

        // Calculate pagination bounds
        let start_idx = page.saturating_mul(page_size);
        let end_idx = core::cmp::min(start_idx.saturating_add(page_size), total);

        if start_idx >= total {
            // Page is out of bounds, return empty result
            return Ok(Vec::new(&env));
        }

        // Load only the chunk(s) the requested range spans
        let escrow_ids = party_index_page_ids(&env, index_role, &party, start_idx, end_idx);

        // Collect escrow summaries for the page
        let mut summaries = Vec::new(&env);
        for escrow_id in escrow_ids.iter() {
            if let Ok(escrow) = load_escrow_entry_v2(&env, escrow_id) {
                let summary = EscrowSummary {
                    escrow_id,
                    depositor: escrow.depositor.clone(),
                    recipient: escrow.recipient.clone(),
                    token_address: escrow.token_address.clone(),
                    total_amount: escrow.total_amount,
                    status: escrow_status(&escrow),
                    deadline: escrow.deadline,
                    metadata_hash: escrow.metadata_hash.clone(),
                };
                summaries.push_back(summary);
            }
        }

        Ok(summaries)
    }

    pub fn get_state(env: Env, escrow_id: u64) -> Result<EscrowStatus, Error> {
        let escrow = Self::get_escrow(env, escrow_id)?;
        Ok(escrow.status)
    }

    pub fn release_milestone(env: Env, escrow_id: u64, milestone_index: u32) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        // For amounts exceeding the threshold, check multi-signature requirements
        let milestone = escrow
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;

        if milestone.amount > escrow.threshold_amount {
            // Above threshold: require depositor auth AND sufficient approved signatures (#622)
            escrow.depositor.require_auth();
            if escrow.collected_signatures.len() < escrow.required_signatures {
                return Err(Error::UnauthorizedAccess);
            }
        } else {
            // For amounts at or below threshold, only depositor can release
            escrow.depositor.require_auth();
        }

        if escrow_status(&escrow) != EscrowStatus::Active {
            return Err(Error::EscrowNotActive);
        }
        if milestone_index >= escrow.milestones.len() {
            return Err(Error::MilestoneNotFound);
        }

        let milestone = escrow
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;
        if milestone.status == MilestoneStatus::Released {
            return Err(Error::MilestoneAlreadyReleased);
        }

        let release = release_pending_milestone(&env, &mut escrow, milestone_index)?;
        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        publish_event(
            &env,
            event_topic(&env, "MilestoneReleased"),
            MilestoneReleasedEvent {
                escrow_id,
                milestone_index,
                depositor: escrow.depositor.clone(),
                recipient: escrow.recipient.clone(),
                token_address: escrow.token_address.clone(),
                milestone_amount: release.milestone_amount,
                payout_amount: release.payout_amount,
                fee_amount: release.fee_amount,
                total_released: release.total_released,
                status: escrow_status(&escrow),
                total_amount: escrow.total_amount,
                deadline: escrow.deadline,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn confirm_delivery(
        env: Env,
        escrow_id: u64,
        milestone_index: u32,
        buyer: Address,
    ) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;
        buyer.require_auth();

        if escrow.depositor != buyer {
            return Err(Error::UnauthorizedAccess);
        }
        if escrow_status(&escrow) != EscrowStatus::Active {
            return Err(Error::EscrowNotActive);
        }
        if milestone_index >= escrow.milestones.len() {
            return Err(Error::MilestoneNotFound);
        }

        let milestone = escrow
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;
        if milestone.status == MilestoneStatus::Released {
            return Err(Error::MilestoneAlreadyReleased);
        }

        if milestone.amount > escrow.threshold_amount {
            // Above threshold: depositor already authed above; also require approved signatures (#622)
            if escrow.collected_signatures.len() < escrow.required_signatures {
                return Err(Error::UnauthorizedAccess);
            }
        }

        let release = release_pending_milestone(&env, &mut escrow, milestone_index)?;
        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        publish_event(
            &env,
            event_topic(&env, "DeliveryConfirmed"),
            DeliveryConfirmedEvent {
                escrow_id,
                milestone_index,
                confirmed_by: buyer,
                depositor: escrow.depositor.clone(),
                recipient: escrow.recipient.clone(),
                token_address: escrow.token_address.clone(),
                milestone_amount: release.milestone_amount,
                payout_amount: release.payout_amount,
                fee_amount: release.fee_amount,
                total_released: release.total_released,
                status: escrow_status(&escrow),
                total_amount: escrow.total_amount,
                deadline: escrow.deadline,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    /// Move an escrow into dispute and anchor the off-chain evidence on chain.
    ///
    /// `evidence_hash` is the raw 32-byte `sha2-256` digest of the evidence the
    /// caller uploaded off-chain (see "Dispute Evidence Hash Interop" in
    /// `docs/contract/README.md`). It is stored under its own escrow-id-keyed
    /// entry and emitted on `DisputeRaisedEvent`, so the off-chain content is
    /// tamper-evident: swapping or deleting it no longer matches the record.
    pub fn raise_dispute(
        env: Env,
        escrow_id: u64,
        caller: Address,
        evidence_hash: BytesN<32>,
    ) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        validate_hash(&evidence_hash)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        if caller != escrow.depositor && caller != escrow.recipient {
            return Err(Error::UnauthorizedAccess);
        }
        caller.require_auth();

        if escrow_status(&escrow) == EscrowStatus::Disputed {
            return Err(Error::AlreadyInDispute);
        }
        // Only funded (Active) escrows can be disputed (#620).
        // Created escrows hold no funds; disputing them would allow resolution
        // payouts from other escrows' pooled balance.
        if escrow_status(&escrow) != EscrowStatus::Active {
            return Err(Error::InvalidEscrowStatus);
        }

        let mut updated_milestones = Vec::new(&env);
        for milestone in escrow.milestones.iter() {
            let mut m = milestone.clone();
            if m.status == MilestoneStatus::Pending {
                m.status = MilestoneStatus::Disputed;
            }
            updated_milestones.push_back(m);
        }

        escrow.milestones = updated_milestones;
        set_escrow_status(&mut escrow, EscrowStatus::Disputed)?;
        set_escrow_resolution(&mut escrow, Resolution::None);
        store_escrow_entry_v2(&env, escrow_id, &escrow)?;
        store_dispute_evidence(&env, escrow_id, &evidence_hash, &escrow);

        publish_event(
            &env,
            event_topic(&env, "DisputeRaised"),
            DisputeRaisedEvent {
                escrow_id,
                raised_by: caller,
                depositor: escrow.depositor.clone(),
                recipient: escrow.recipient.clone(),
                evidence_hash,
                status: escrow_status(&escrow),
                total_amount: escrow.total_amount,
                total_released: escrow.total_released,
                deadline: escrow.deadline,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    /// Resolve a dispute, optionally anchoring the arbitrator's own evidence.
    ///
    /// `resolution_evidence_hash` is optional: passing `None` is a fully valid,
    /// zero-friction path for arbitrators who publish no ruling document. When
    /// `Some`, it follows the same digest convention as `raise_dispute`'s
    /// `evidence_hash` and is validated with the same rules.
    pub fn resolve_dispute(
        env: Env,
        escrow_id: u64,
        winner: Address,
        split_winner_amount: Option<i128>,
        resolution_evidence_hash: Option<BytesN<32>>,
    ) -> Result<(), Error> {
        let arbitrator = get_arbitrator_internal(&env)?;
        arbitrator.require_auth();

        if let Some(hash) = resolution_evidence_hash.as_ref() {
            validate_hash(hash)?;
        }

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        if escrow_status(&escrow) != EscrowStatus::Disputed {
            return Err(Error::InvalidEscrowStatus);
        }
        if winner != escrow.depositor && winner != escrow.recipient {
            return Err(Error::InvalidWinner);
        }

        // Cap the distributable amount at the actual funded balance (#620).
        // This prevents resolve_dispute from spending other escrows' pooled funds
        // when an escrow was never properly funded.
        let nominal_outstanding = escrow
            .total_amount
            .checked_sub(escrow.total_released)
            .ok_or(Error::InvalidMilestoneAmount)?;
        let funded_outstanding = escrow
            .funded_amount
            .checked_sub(escrow.total_released)
            .ok_or(Error::InvalidMilestoneAmount)?;
        let outstanding = core::cmp::min(nominal_outstanding, funded_outstanding);

        if outstanding < 0 {
            return Err(Error::InvalidMilestoneAmount);
        }

        let other = if winner == escrow.depositor {
            escrow.recipient.clone()
        } else {
            escrow.depositor.clone()
        };

        // Split uses exact token amounts (not basis points).
        // winner_amount must be in [0, outstanding]; the remainder goes to the other party.
        let (amount_to_winner, amount_to_other) = match split_winner_amount {
            None => (outstanding, 0i128),
            Some(winner_amount) => {
                if winner_amount < 0 || winner_amount > outstanding {
                    return Err(Error::InvalidMilestoneAmount);
                }
                let other_amount = outstanding
                    .checked_sub(winner_amount)
                    .ok_or(Error::InvalidMilestoneAmount)?;
                (winner_amount, other_amount)
            }
        };

        // Invariant: total distribution must equal outstanding balance.
        // Prevents the contract from sending more than it holds for this escrow.
        let total_distribution = amount_to_winner
            .checked_add(amount_to_other)
            .ok_or(Error::InvalidMilestoneAmount)?;
        if total_distribution != outstanding {
            return Err(Error::InvalidMilestoneAmount);
        }

        let token_client = token::Client::new(&env, &escrow.token_address);

        if amount_to_winner > 0 {
            safe_transfer(
                &token_client,
                &env.current_contract_address(),
                &winner,
                amount_to_winner,
            )?;
        }

        if amount_to_other > 0 {
            safe_transfer(
                &token_client,
                &env.current_contract_address(),
                &other,
                amount_to_other,
            )?;
        }

        // Update accounting and milestone statuses
        let (amount_to_recipient, resolution) = if amount_to_winner == outstanding
            && amount_to_other == 0
        {
            if winner == escrow.recipient {
                // Full payout to recipient
                let mut updated_milestones = Vec::new(&env);
                for milestone in escrow.milestones.iter() {
                    let mut m = milestone.clone();
                    if m.status != MilestoneStatus::Released {
                        m.status = MilestoneStatus::Released;
                    }
                    updated_milestones.push_back(m);
                }
                escrow.milestones = updated_milestones;
                (outstanding, Resolution::Recipient)
            } else {
                // Full refund to depositor
                let mut updated_milestones = Vec::new(&env);
                for milestone in escrow.milestones.iter() {
                    let mut m = milestone.clone();
                    if m.status == MilestoneStatus::Pending || m.status == MilestoneStatus::Disputed
                    {
                        m.status = MilestoneStatus::Disputed;
                    }
                    updated_milestones.push_back(m);
                }
                escrow.milestones = updated_milestones;
                (0i128, Resolution::Depositor)
            }
        } else {
            // Split resolution
            let mut updated_milestones = Vec::new(&env);
            for milestone in escrow.milestones.iter() {
                let mut m = milestone.clone();
                if m.status != MilestoneStatus::Released {
                    m.status = MilestoneStatus::Disputed;
                }
                updated_milestones.push_back(m);
            }
            escrow.milestones = updated_milestones;

            let recipient_amount = if winner == escrow.recipient {
                amount_to_winner
            } else {
                amount_to_other
            };
            (recipient_amount, Resolution::Split)
        };

        escrow.total_released = escrow
            .total_released
            .checked_add(amount_to_recipient)
            .ok_or(Error::InvalidMilestoneAmount)?;

        if escrow.total_released > escrow.total_amount {
            return Err(Error::InvalidMilestoneAmount);
        }

        set_escrow_resolution(&mut escrow, resolution);
        set_escrow_status(&mut escrow, EscrowStatus::Resolved)?;
        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        if let Some(hash) = resolution_evidence_hash.as_ref() {
            store_dispute_resolution_evidence(&env, escrow_id, hash, &escrow);
        }

        publish_event(
            &env,
            event_topic(&env, "DisputeResolved"),
            DisputeResolvedEvent {
                escrow_id,
                winner,
                other_party: other,
                winner_amount: amount_to_winner,
                other_amount: amount_to_other,
                resolution,
                resolution_evidence_hash,
                status: escrow_status(&escrow),
                total_amount: escrow.total_amount,
                total_released: escrow.total_released,
                deadline: escrow.deadline,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn cancel_escrow(env: Env, escrow_id: u64) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;
        escrow.depositor.require_auth();

        if escrow_status(&escrow) != EscrowStatus::Active
            && escrow_status(&escrow) != EscrowStatus::Created
        {
            return Err(Error::InvalidEscrowStatus);
        }
        if escrow.total_released > 0 {
            return Err(Error::MilestoneAlreadyReleased);
        }

        let mut refund_amount = 0i128;
        let mut fee_amount = 0i128;

        if escrow_status(&escrow) == EscrowStatus::Active {
            let token_client = token::Client::new(&env, &escrow.token_address);
            refund_amount = if let Ok((treasury, _)) = Self::get_config(env.clone()) {
                let fee_bps = resolve_fee_with_escrow_override(
                    &env,
                    &escrow.token_address,
                    escrow_fee_override_opt(&escrow),
                )?;
                fee_amount = calculate_fee(escrow.total_amount, fee_bps)?;
                if fee_amount > 0 {
                    safe_transfer(
                        &token_client,
                        &env.current_contract_address(),
                        &treasury,
                        fee_amount,
                    )?;
                }
                escrow
                    .total_amount
                    .checked_sub(fee_amount)
                    .ok_or(Error::InvalidMilestoneAmount)?
            } else {
                escrow.total_amount
            };

            if refund_amount > 0 {
                safe_transfer(
                    &token_client,
                    &env.current_contract_address(),
                    &escrow.depositor,
                    refund_amount,
                )?;
            }
        }

        set_escrow_status(&mut escrow, EscrowStatus::Cancelled)?;
        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        publish_event(
            &env,
            event_topic(&env, "EscrowCancelled"),
            EscrowCancelledEvent {
                escrow_id,
                cancelled_by: escrow.depositor.clone(),
                depositor: escrow.depositor.clone(),
                token_address: escrow.token_address.clone(),
                refund_amount,
                fee_amount,
                status: escrow_status(&escrow),
                total_amount: escrow.total_amount,
                total_released: escrow.total_released,
                deadline: escrow.deadline,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn complete_escrow(env: Env, escrow_id: u64) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;
        escrow.depositor.require_auth();

        if escrow_status(&escrow) != EscrowStatus::Active {
            return Err(Error::InvalidEscrowStatus);
        }
        if !verify_all_released(&escrow.milestones) {
            return Err(Error::EscrowNotActive);
        }

        set_escrow_status(&mut escrow, EscrowStatus::Completed)?;
        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        publish_event(
            &env,
            event_topic(&env, "EscrowCompleted"),
            EscrowCompletedEvent {
                escrow_id,
                completed_by: escrow.depositor.clone(),
                total_released: escrow.total_released,
                status: escrow_status(&escrow),
                total_amount: escrow.total_amount,
                deadline: escrow.deadline,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn refund_expired(env: Env, escrow_id: u64, caller: Address) -> Result<(), Error> {
        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        // Validate deadline has passed
        let current_time = env.ledger().timestamp();
        if current_time <= escrow.deadline {
            return Err(Error::DeadlineNotReached);
        }

        // Validate escrow status is Active
        if escrow_status(&escrow) != EscrowStatus::Active {
            return Err(Error::InvalidStatusForRefund);
        }

        // Authorization validation - only buyer can refund
        caller.require_auth();
        if caller != escrow.depositor {
            return Err(Error::Unauthorized);
        }

        // Calculate remaining balance
        let remaining_balance = escrow
            .total_amount
            .checked_sub(escrow.total_released)
            .ok_or(Error::InvalidMilestoneAmount)?;

        // Check if there are funds to refund
        if remaining_balance <= 0 {
            return Err(Error::NoFundsToRefund);
        }

        // Retrieve platform fee BPS from contract configuration
        let (treasury, _) = Self::get_config(env.clone())?;

        // Resolve fee with precedence: escrow > token > global
        let fee_bps = resolve_fee_with_escrow_override(
            &env,
            &escrow.token_address,
            escrow_fee_override_opt(&escrow),
        )?;

        // Calculate platform fee using checked arithmetic
        let platform_fee = calculate_fee(remaining_balance, fee_bps)?;

        // Calculate refund amount
        let refund_amount = remaining_balance
            .checked_sub(platform_fee)
            .ok_or(Error::InvalidMilestoneAmount)?;

        // Get token client for escrow's token address
        let token_client = token::Client::new(&env, &escrow.token_address);

        // Transfer refund amount to buyer
        safe_transfer(
            &token_client,
            &env.current_contract_address(),
            &escrow.depositor,
            refund_amount,
        )?;

        // If platform fee > 0, transfer fee to fee recipient
        if platform_fee > 0 {
            safe_transfer(
                &token_client,
                &env.current_contract_address(),
                &treasury,
                platform_fee,
            )?;
        }

        // Update escrow state: mark unfunded milestones as disputed (refunded path)
        // and transition to Expired without inflating total_released past released milestones.
        let mut updated_milestones = Vec::new(&env);
        for milestone in escrow.milestones.iter() {
            let mut m = milestone.clone();
            if m.status == MilestoneStatus::Pending {
                m.status = MilestoneStatus::Disputed;
            }
            updated_milestones.push_back(m);
        }
        escrow.milestones = updated_milestones;

        set_escrow_status(&mut escrow, EscrowStatus::Expired)?;
        store_escrow_entry_v2(&env, escrow_id, &escrow)?;

        publish_event(
            &env,
            event_topic(&env, "EscrowExpiredRefunded"),
            EscrowExpiredRefundedEvent {
                escrow_id,
                refunded_to: escrow.depositor.clone(),
                token_address: escrow.token_address.clone(),
                refund_amount,
                fee_amount: platform_fee,
                status: escrow_status(&escrow),
                total_amount: escrow.total_amount,
                total_released: escrow.total_released,
                deadline: escrow.deadline,
                timestamp: current_time,
            },
        );

        Ok(())
    }
}

fn get_storage_key_legacy(escrow_id: u64) -> (Symbol, u64) {
    (symbol_short!("escrow"), escrow_id)
}

/// Generates storage key for escrow version markers.
/// This companion key is stored alongside the V2 escrow entry for explicit versioning.
fn get_escrow_version_key(escrow_id: u64) -> (Symbol, u64) {
    (symbol_short!("escver"), escrow_id)
}

/// Publishes a contract event using the explicit `(topics, data)` form.
///
/// soroban-sdk 21+ deprecates `Events::publish` in favour of the
/// `#[contractevent]` macro, but that macro derives its own topic layout from
/// the event type name. This contract's topics are a published interface
/// (`(Vaultix, v1, EventName)`) that off-chain indexers already consume, so we
/// deliberately keep the manual form. The `allow` is confined to this one
/// wrapper so the migration, if ever wanted, is a single-site change.
#[allow(deprecated)]
fn publish_event<T, D>(env: &Env, topics: T, data: D)
where
    T: soroban_sdk::events::Topics,
    D: soroban_sdk::IntoVal<Env, soroban_sdk::Val>,
{
    env.events().publish(topics, data);
}

fn event_topic(env: &Env, event_name: &str) -> (Symbol, Symbol, Symbol) {
    (
        Symbol::new(env, EVENT_NAMESPACE),
        Symbol::new(env, EVENT_SCHEMA_VERSION),
        Symbol::new(env, event_name),
    )
}

fn current_timestamp(env: &Env) -> u64 {
    env.ledger().timestamp()
}

/// Generates storage key for the current V2 escrow format.
/// The `esc2` prefix distinguishes current entries from legacy `escrow` storage.
fn get_storage_key_v2(escrow_id: u64) -> (Symbol, u64) {
    (symbol_short!("esc2"), escrow_id)
}

/// Generates storage key for token-specific fee override
/// Returns a tuple of (Symbol, Address) for scoped storage access
fn get_token_fee_key(token_address: &Address) -> (Symbol, Address) {
    (symbol_short!("tokfee"), token_address.clone())
}

/// Generates storage key for escrow-specific fee override
/// Returns a tuple of (Symbol, u64) for scoped storage access
fn get_escrow_fee_key(escrow_id: u64) -> (Symbol, u64) {
    (symbol_short!("escfee"), escrow_id)
}

/// Generates storage key for the dispute evidence hash recorded by `raise_dispute`
/// Returns a tuple of (Symbol, u64) for scoped storage access
fn get_dispute_evidence_key(escrow_id: u64) -> (Symbol, u64) {
    (symbol_short!("dispev"), escrow_id)
}

/// Generates storage key for the arbitrator's optional resolution evidence hash
/// Returns a tuple of (Symbol, u64) for scoped storage access
fn get_dispute_resolution_evidence_key(escrow_id: u64) -> (Symbol, u64) {
    (symbol_short!("disprev"), escrow_id)
}

/// Legacy (pre-chunking) storage key for the depositor index.
/// Held a single unbounded `Vec<u64>`; only read during lazy migration.
fn get_depositor_index_key(depositor: &Address) -> (Symbol, Address) {
    (symbol_short!("depidx"), depositor.clone())
}

/// Legacy (pre-chunking) storage key for the recipient index.
/// Held a single unbounded `Vec<u64>`; only read during lazy migration.
fn get_recipient_index_key(recipient: &Address) -> (Symbol, Address) {
    (symbol_short!("recidx"), recipient.clone())
}

/// Which per-party index a chunked-index operation targets.
#[derive(Clone, Copy, PartialEq, Eq)]
enum PartyIndexRole {
    Depositor,
    Recipient,
}

/// Storage key holding the total number of ids appended for a (party, role).
/// Shape: `(Symbol, Address) -> u32`.
fn party_index_count_key(role: PartyIndexRole, party: &Address) -> (Symbol, Address) {
    match role {
        PartyIndexRole::Depositor => (symbol_short!("depcnt"), party.clone()),
        PartyIndexRole::Recipient => (symbol_short!("reccnt"), party.clone()),
    }
}

/// Storage key for one bounded chunk of ids for a (party, role).
/// Shape: `(Symbol, Address, u32) -> Vec<u64>` with at most
/// `PARTY_INDEX_CHUNK_SIZE` entries per chunk.
fn party_index_chunk_key(
    role: PartyIndexRole,
    party: &Address,
    chunk_index: u32,
) -> (Symbol, Address, u32) {
    match role {
        PartyIndexRole::Depositor => (symbol_short!("depchk"), party.clone(), chunk_index),
        PartyIndexRole::Recipient => (symbol_short!("recchk"), party.clone(), chunk_index),
    }
}

/// Legacy single-vector key for a (party, role), used only for lazy migration.
fn party_index_legacy_key(role: PartyIndexRole, party: &Address) -> (Symbol, Address) {
    match role {
        PartyIndexRole::Depositor => get_depositor_index_key(party),
        PartyIndexRole::Recipient => get_recipient_index_key(party),
    }
}

fn extend_party_index_count_ttl(env: &Env, key: &(Symbol, Address)) {
    env.storage().persistent().extend_ttl(
        key,
        PARTY_INDEX_TTL_THRESHOLD,
        PARTY_INDEX_TTL_EXTEND_TO,
    );
}

fn extend_party_index_chunk_ttl(env: &Env, key: &(Symbol, Address, u32)) {
    env.storage().persistent().extend_ttl(
        key,
        PARTY_INDEX_TTL_THRESHOLD,
        PARTY_INDEX_TTL_EXTEND_TO,
    );
}

/// Returns the number of ids indexed for a (party, role), migrating the legacy
/// unbounded vector into chunks the first time the index is touched.
///
/// O(1) for already-migrated parties: a single scalar read of the count key.
fn party_index_total(env: &Env, role: PartyIndexRole, party: &Address) -> u32 {
    let count_key = party_index_count_key(role, party);
    if let Some(count) = env
        .storage()
        .persistent()
        .get::<(Symbol, Address), u32>(&count_key)
    {
        extend_party_index_count_ttl(env, &count_key);
        return count;
    }

    migrate_legacy_party_index(env, role, party, &count_key)
}

/// Lazily converts a legacy `Vec<u64>` index into chunked storage.
/// Returns the migrated count (0 when the party has no legacy entry).
fn migrate_legacy_party_index(
    env: &Env,
    role: PartyIndexRole,
    party: &Address,
    count_key: &(Symbol, Address),
) -> u32 {
    let legacy_key = party_index_legacy_key(role, party);
    let legacy_ids: Vec<u64> = match env
        .storage()
        .persistent()
        .get::<(Symbol, Address), Vec<u64>>(&legacy_key)
    {
        Some(ids) => ids,
        // Brand-new party: nothing to migrate, start empty without writing.
        None => return 0,
    };

    let total = legacy_ids.len();
    let mut chunk_index = 0u32;
    let mut chunk: Vec<u64> = Vec::new(env);
    for id in legacy_ids.iter() {
        chunk.push_back(id);
        if chunk.len() == PARTY_INDEX_CHUNK_SIZE {
            let chunk_key = party_index_chunk_key(role, party, chunk_index);
            env.storage().persistent().set(&chunk_key, &chunk);
            extend_party_index_chunk_ttl(env, &chunk_key);
            chunk_index += 1;
            chunk = Vec::new(env);
        }
    }
    if !chunk.is_empty() {
        let chunk_key = party_index_chunk_key(role, party, chunk_index);
        env.storage().persistent().set(&chunk_key, &chunk);
        extend_party_index_chunk_ttl(env, &chunk_key);
    }

    env.storage().persistent().set(count_key, &total);
    extend_party_index_count_ttl(env, count_key);
    env.storage().persistent().remove(&legacy_key);

    total
}

/// Appends an escrow id to a party index in O(1) storage work: one scalar read,
/// one bounded chunk read/write, one scalar write. History size is irrelevant.
fn party_index_append(env: &Env, role: PartyIndexRole, party: &Address, escrow_id: u64) {
    let total = party_index_total(env, role, party);
    let chunk_index = total / PARTY_INDEX_CHUNK_SIZE;
    let chunk_key = party_index_chunk_key(role, party, chunk_index);

    let mut chunk: Vec<u64> = env
        .storage()
        .persistent()
        .get(&chunk_key)
        .unwrap_or_else(|| Vec::new(env));
    chunk.push_back(escrow_id);
    env.storage().persistent().set(&chunk_key, &chunk);
    extend_party_index_chunk_ttl(env, &chunk_key);

    let count_key = party_index_count_key(role, party);
    let new_total = total.saturating_add(1);
    env.storage().persistent().set(&count_key, &new_total);
    extend_party_index_count_ttl(env, &count_key);
}

/// Reads the ids in `[start_idx, end_idx)` for a party index, loading only the
/// chunks that range actually spans (at most two for a valid page size).
fn party_index_page_ids(
    env: &Env,
    role: PartyIndexRole,
    party: &Address,
    start_idx: u32,
    end_idx: u32,
) -> Vec<u64> {
    let mut ids: Vec<u64> = Vec::new(env);
    if start_idx >= end_idx {
        return ids;
    }

    let first_chunk = start_idx / PARTY_INDEX_CHUNK_SIZE;
    let last_chunk = (end_idx - 1) / PARTY_INDEX_CHUNK_SIZE;

    for chunk_index in first_chunk..=last_chunk {
        let chunk_key = party_index_chunk_key(role, party, chunk_index);
        let chunk: Vec<u64> = match env.storage().persistent().get(&chunk_key) {
            Some(chunk) => chunk,
            None => continue,
        };
        extend_party_index_chunk_ttl(env, &chunk_key);

        let chunk_start = chunk_index * PARTY_INDEX_CHUNK_SIZE;
        let local_start = start_idx.saturating_sub(chunk_start);
        let local_end = core::cmp::min(end_idx - chunk_start, chunk.len());
        let mut i = local_start;
        while i < local_end {
            ids.push_back(chunk.get(i).unwrap());
            i += 1;
        }
    }

    ids
}

fn resolve_fee_with_escrow_override(
    env: &Env,
    token_address: &Address,
    escrow_fee_override: Option<i128>,
) -> Result<i128, Error> {
    if let Some(escrow_fee) = escrow_fee_override {
        return Ok(escrow_fee);
    }

    // Check token-specific override second
    let token_fee_key = get_token_fee_key(token_address);
    if let Some(token_fee) = env
        .storage()
        .persistent()
        .get::<(Symbol, Address), i128>(&token_fee_key)
    {
        return Ok(token_fee);
    }

    // Fall back to global default fee
    let global_fee: i128 = env
        .storage()
        .instance()
        .get(&symbol_short!("fee_bps"))
        .unwrap_or(DEFAULT_FEE_BPS);

    Ok(global_fee)
}

fn release_pending_milestone(
    env: &Env,
    escrow: &mut EscrowEntryV2,
    milestone_index: u32,
) -> Result<ReleaseOutcome, Error> {
    if escrow_status(escrow) != EscrowStatus::Active {
        return Err(Error::EscrowNotActive);
    }

    let mut milestone = escrow
        .milestones
        .get(milestone_index)
        .ok_or(Error::MilestoneNotFound)?;
    if milestone.status == MilestoneStatus::Released {
        return Err(Error::MilestoneAlreadyReleased);
    }

    let (treasury, _) = VaultixEscrow::get_config(env.clone())?;
    let fee_bps = resolve_fee_with_escrow_override(
        env,
        &escrow.token_address,
        escrow_fee_override_opt(escrow),
    )?;
    let fee_amount = calculate_fee(milestone.amount, fee_bps)?;
    let payout_amount = milestone
        .amount
        .checked_sub(fee_amount)
        .ok_or(Error::InvalidMilestoneAmount)?;

    let token_client = token::Client::new(env, &escrow.token_address);
    safe_transfer(
        &token_client,
        &env.current_contract_address(),
        &escrow.recipient,
        payout_amount,
    )?;

    if fee_amount > 0 {
        safe_transfer(
            &token_client,
            &env.current_contract_address(),
            &treasury,
            fee_amount,
        )?;
    }

    milestone.status = MilestoneStatus::Released;
    escrow.milestones.set(milestone_index, milestone.clone());

    escrow.total_released = escrow
        .total_released
        .checked_add(milestone.amount)
        .ok_or(Error::InvalidMilestoneAmount)?;

    Ok(ReleaseOutcome {
        milestone_amount: milestone.amount,
        payout_amount,
        fee_amount,
        total_released: escrow.total_released,
    })
}

/// Safely transfer tokens from `from` to `to`, returning an error if balance is insufficient.
fn safe_transfer(
    token_client: &token::Client,
    from: &Address,
    to: &Address,
    amount: i128,
) -> Result<(), Error> {
    if amount <= 0 {
        return Ok(());
    }
    let balance = token_client.balance(from);
    if balance < amount {
        return Err(Error::InsufficientBalance);
    }
    token_client.transfer(from, to, &amount);
    Ok(())
}

fn ensure_not_paused(env: &Env) -> Result<(), Error> {
    let state: ContractState = env
        .storage()
        .instance()
        .get(&symbol_short!("state"))
        .unwrap_or(ContractState::Active);
    if state == ContractState::Paused {
        return Err(Error::ContractPaused);
    }
    Ok(())
}

/// Verifies the contract has been initialized via `__constructor`.
///
/// Returns `ContractNotInitialized` when `create_escrow`, `create_escrows_batch`,
/// or `deposit_funds` is called on a contract that was deployed without
/// constructor args (#621).
fn ensure_initialized(env: &Env) -> Result<(), Error> {
    if !env.storage().instance().has(&symbol_short!("init")) {
        return Err(Error::ContractNotInitialized);
    }
    Ok(())
}

fn admin_storage_key() -> Symbol {
    symbol_short!("admin")
}

fn admin_proposal_storage_key() -> Symbol {
    symbol_short!("admprop")
}

fn extend_admin_proposal_ttl(env: &Env) {
    let key = admin_proposal_storage_key();
    if env.storage().persistent().has(&key) {
        env.storage().persistent().extend_ttl(&key, 100, 2_000_000);
    }
}

fn load_admin_proposal(env: &Env) -> Result<AdminProposal, Error> {
    let key = admin_proposal_storage_key();
    let proposal = env
        .storage()
        .persistent()
        .get::<Symbol, AdminProposal>(&key)
        .ok_or(Error::AdminProposalNotFound)?;
    extend_admin_proposal_ttl(env);
    Ok(proposal)
}

fn operator_storage_key() -> Symbol {
    symbol_short!("oper")
}

fn arbitrator_storage_key() -> Symbol {
    symbol_short!("arbi")
}

fn extend_roles_ttl(env: &Env) {
    env.storage()
        .persistent()
        .extend_ttl(&admin_storage_key(), 100, 2_000_000);
    env.storage()
        .persistent()
        .extend_ttl(&operator_storage_key(), 100, 2_000_000);
    env.storage()
        .persistent()
        .extend_ttl(&arbitrator_storage_key(), 100, 2_000_000);
}

fn get_admin_internal(env: &Env) -> Result<Address, Error> {
    let admin = env
        .storage()
        .persistent()
        .get(&admin_storage_key())
        .ok_or(Error::AdminNotInitialized)?;
    extend_roles_ttl(env);
    Ok(admin)
}

fn get_treasury_internal(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get::<Symbol, Address>(&symbol_short!("treasury"))
        .ok_or(Error::TreasuryNotInitialized)
}

fn validate_milestones(milestones: &Vec<Milestone>) -> Result<i128, Error> {
    if milestones.len() > 20 {
        return Err(Error::VectorTooLarge);
    }
    let mut total: i128 = 0;
    for milestone in milestones.iter() {
        if milestone.amount <= 0 {
            return Err(Error::ZeroAmount);
        }
        total = total
            .checked_add(milestone.amount)
            .ok_or(Error::InvalidMilestoneAmount)?;
    }
    Ok(total)
}

/// Shared validator for 32-byte content digests stored on chain
/// (escrow `metadata_hash`, dispute evidence hashes).
///
/// The all-zero digest is rejected: it is the value a caller ends up with when
/// no hash was actually computed, so accepting it would anchor nothing.
fn validate_hash(hash: &BytesN<32>) -> Result<(), Error> {
    if hash.to_array() == [0u8; 32] {
        return Err(Error::InvalidMetadataHash);
    }

    Ok(())
}

fn verify_all_released(milestones: &Vec<Milestone>) -> bool {
    for milestone in milestones.iter() {
        if milestone.status != MilestoneStatus::Released {
            return false;
        }
    }
    true
}

/// Calculate platform fee using basis points (BPS)
/// Formula: fee = (amount * fee_bps) / 10000
/// Uses checked arithmetic to prevent overflow
fn calculate_fee(amount: i128, fee_bps: i128) -> Result<i128, Error> {
    // Multiply amount by fee basis points with overflow protection
    let fee_numerator = amount
        .checked_mul(fee_bps)
        .ok_or(Error::InvalidMilestoneAmount)?;

    // Divide by BPS denominator (10000) to get final fee
    let fee = fee_numerator
        .checked_div(BPS_DENOMINATOR)
        .ok_or(Error::InvalidMilestoneAmount)?;

    Ok(fee)
}

fn get_operator_internal(env: &Env) -> Result<Address, Error> {
    if let Some(op) = env
        .storage()
        .persistent()
        .get::<Symbol, Address>(&operator_storage_key())
    {
        extend_roles_ttl(env);
        return Ok(op);
    }

    let legacy_key = Symbol::new(env, "operator");
    let op: Address = env
        .storage()
        .persistent()
        .get(&legacy_key)
        .ok_or(Error::OperatorNotInitialized)?;
    env.storage().persistent().set(&operator_storage_key(), &op);
    env.storage().persistent().remove(&legacy_key);
    extend_roles_ttl(env);
    Ok(op)
}

fn get_arbitrator_internal(env: &Env) -> Result<Address, Error> {
    if let Some(a) = env
        .storage()
        .persistent()
        .get::<Symbol, Address>(&arbitrator_storage_key())
    {
        extend_roles_ttl(env);
        return Ok(a);
    }

    let legacy_key = Symbol::new(env, "arbitrator");
    let a: Address = env
        .storage()
        .persistent()
        .get(&legacy_key)
        .ok_or(Error::ArbitratorNotInitialized)?;
    env.storage()
        .persistent()
        .set(&arbitrator_storage_key(), &a);
    env.storage().persistent().remove(&legacy_key);
    extend_roles_ttl(env);
    Ok(a)
}

fn emit_role_updated(
    env: &Env,
    role: Role,
    old_address: Option<Address>,
    new_address: Address,
    timestamp: u64,
) {
    let had_old_address = old_address.is_some();
    let prior_address = old_address.unwrap_or(new_address.clone());

    publish_event(
        env,
        event_topic(env, "RoleUpdated"),
        RoleUpdatedEvent {
            role,
            had_old_address,
            old_address: prior_address,
            new_address,
            timestamp,
        },
    );
}

fn escrow_fee_override_opt(escrow: &EscrowEntryV2) -> Option<i128> {
    if escrow.fee_override_bps >= 0 {
        Some(escrow.fee_override_bps)
    } else {
        None
    }
}

fn escrow_status(escrow: &EscrowEntryV2) -> EscrowStatus {
    unpack_escrow_status(escrow.packed_state)
}

fn set_escrow_status(escrow: &mut EscrowEntryV2, status: EscrowStatus) -> Result<(), Error> {
    let current = escrow_status(escrow);
    validate_status_transition(current, status)?;
    let resolution = unpack_escrow_resolution(escrow.packed_state);
    escrow.packed_state = pack_escrow_state(status, resolution);
    Ok(())
}

fn set_escrow_resolution(escrow: &mut EscrowEntryV2, resolution: Resolution) {
    let status = unpack_escrow_status(escrow.packed_state);
    escrow.packed_state = pack_escrow_state(status, resolution);
}

fn pack_escrow_state(status: EscrowStatus, resolution: Resolution) -> u32 {
    (escrow_status_to_u32(status) & 0x7) | ((resolution_to_u32(resolution) & 0x3) << 3)
}

fn unpack_escrow_status(packed_state: u32) -> EscrowStatus {
    u32_to_escrow_status(packed_state & 0x7)
}

fn unpack_escrow_resolution(packed_state: u32) -> Resolution {
    u32_to_resolution((packed_state >> 3) & 0x3)
}

fn escrow_status_to_u32(status: EscrowStatus) -> u32 {
    match status {
        EscrowStatus::Created => 0,
        EscrowStatus::Active => 1,
        EscrowStatus::Completed => 2,
        EscrowStatus::Cancelled => 3,
        EscrowStatus::Disputed => 4,
        EscrowStatus::Resolved => 5,
        EscrowStatus::Expired => 6,
    }
}

fn u32_to_escrow_status(v: u32) -> EscrowStatus {
    match v {
        0 => EscrowStatus::Created,
        1 => EscrowStatus::Active,
        2 => EscrowStatus::Completed,
        3 => EscrowStatus::Cancelled,
        4 => EscrowStatus::Disputed,
        5 => EscrowStatus::Resolved,
        _ => EscrowStatus::Expired,
    }
}

fn resolution_to_u32(r: Resolution) -> u32 {
    match r {
        Resolution::None => 0,
        Resolution::Depositor => 1,
        Resolution::Recipient => 2,
        Resolution::Split => 3,
    }
}

fn u32_to_resolution(v: u32) -> Resolution {
    match v {
        0 => Resolution::None,
        1 => Resolution::Depositor,
        2 => Resolution::Recipient,
        _ => Resolution::Split,
    }
}

fn set_escrow_entry_version(env: &Env, escrow_id: u64, version: i128) {
    let version_key = get_escrow_version_key(escrow_id);
    env.storage().persistent().set(&version_key, &version);
    env.storage()
        .persistent()
        .extend_ttl(&version_key, 100, 1_000_000);
}

fn store_escrow_entry_v2(env: &Env, escrow_id: u64, escrow: &EscrowEntryV2) -> Result<(), Error> {
    // Single persistence gate: invalid escrow state must never be written to storage.
    validate_escrow_invariants(escrow)?;
    let key = get_storage_key_v2(escrow_id);
    env.storage().persistent().set(&key, escrow);
    set_escrow_entry_version(env, escrow_id, ESCROW_ENTRY_STORAGE_VERSION);
    extend_escrow_ttl(env, &key, escrow);
    Ok(())
}

/// Legacy escrows may have been stored with an empty milestone list while still
/// carrying a non-zero `total_amount`. Synthesize a single milestone so migrated
/// entries satisfy current invariants.
fn normalize_legacy_milestones(env: &Env, legacy: &Escrow) -> Vec<Milestone> {
    if !legacy.milestones.is_empty() {
        return legacy.milestones.clone();
    }

    if legacy.total_amount <= 0 {
        return Vec::new(env);
    }

    let milestone_status = if legacy.total_released >= legacy.total_amount {
        MilestoneStatus::Released
    } else if legacy.status == EscrowStatus::Disputed {
        MilestoneStatus::Disputed
    } else {
        MilestoneStatus::Pending
    };

    let mut milestones = Vec::new(env);
    milestones.push_back(Milestone {
        amount: legacy.total_amount,
        status: milestone_status,
        description: symbol_short!("legacy"),
    });
    milestones
}

fn load_escrow_entry_v2(env: &Env, escrow_id: u64) -> Result<EscrowEntryV2, Error> {
    let v2_key = get_storage_key_v2(escrow_id);
    if let Some(v2) = env
        .storage()
        .persistent()
        .get::<(Symbol, u64), EscrowEntryV2>(&v2_key)
    {
        if let Some(version) = env
            .storage()
            .persistent()
            .get::<(Symbol, u64), i128>(&get_escrow_version_key(escrow_id))
        {
            if version > ESCROW_ENTRY_STORAGE_VERSION {
                return Err(Error::UnsupportedEscrowVersion);
            }
        } else {
            set_escrow_entry_version(env, escrow_id, ESCROW_ENTRY_STORAGE_VERSION);
        }
        extend_escrow_ttl(env, &v2_key, &v2);
        return Ok(v2);
    }

    let legacy_key = get_storage_key_legacy(escrow_id);
    let legacy: Escrow = env
        .storage()
        .persistent()
        .get(&legacy_key)
        .ok_or(Error::EscrowNotFound)?;

    let fee_override_bps = env
        .storage()
        .persistent()
        .get::<(Symbol, u64), i128>(&get_escrow_fee_key(escrow_id))
        .unwrap_or(-1);

    let milestones = normalize_legacy_milestones(env, &legacy);

    let v2 = EscrowEntryV2 {
        depositor: legacy.depositor,
        recipient: legacy.recipient,
        token_address: legacy.token_address,
        total_amount: legacy.total_amount,
        total_released: legacy.total_released,
        milestones,
        packed_state: pack_escrow_state(legacy.status, legacy.resolution),
        deadline: legacy.deadline,
        threshold_amount: legacy.threshold_amount,
        required_signatures: legacy.required_signatures,
        collected_signatures: legacy.collected_signatures,
        fee_override_bps,
        metadata_hash: legacy.metadata_hash,
        // Infer funded_amount from status: if the legacy escrow was ever
        // funded (Active, Disputed, Completed, Resolved, Expired) the
        // total_amount was deposited; otherwise 0.
        funded_amount: match legacy.status {
            EscrowStatus::Active
            | EscrowStatus::Disputed
            | EscrowStatus::Completed
            | EscrowStatus::Resolved
            | EscrowStatus::Expired => legacy.total_amount,
            _ => 0,
        },
        approved_signers: Vec::new(env),
    };

    env.storage().persistent().remove(&legacy_key);
    if fee_override_bps >= 0 {
        env.storage()
            .persistent()
            .remove(&get_escrow_fee_key(escrow_id));
    }

    store_escrow_entry_v2(env, escrow_id, &v2)?;
    Ok(v2)
}

fn escrow_entry_to_public(escrow: EscrowEntryV2) -> Escrow {
    Escrow {
        depositor: escrow.depositor,
        recipient: escrow.recipient,
        token_address: escrow.token_address,
        total_amount: escrow.total_amount,
        total_released: escrow.total_released,
        milestones: escrow.milestones,
        status: unpack_escrow_status(escrow.packed_state),
        deadline: escrow.deadline,
        resolution: unpack_escrow_resolution(escrow.packed_state),
        threshold_amount: escrow.threshold_amount,
        required_signatures: escrow.required_signatures,
        collected_signatures: escrow.collected_signatures,
        metadata_hash: escrow.metadata_hash,
        funded_amount: escrow.funded_amount,
        approved_signers: escrow.approved_signers,
    }
}

/// Persists the dispute evidence digest as a side entry keyed by escrow id and
/// gives it the same TTL as the escrow entry it belongs to, so a live dispute
/// cannot outlive its own evidence record.
fn store_dispute_evidence(
    env: &Env,
    escrow_id: u64,
    evidence_hash: &BytesN<32>,
    escrow: &EscrowEntryV2,
) {
    let key = get_dispute_evidence_key(escrow_id);
    env.storage().persistent().set(&key, evidence_hash);
    extend_escrow_ttl(env, &key, escrow);
}

/// Persists the arbitrator's optional resolution evidence digest alongside the
/// dispute evidence, with the same escrow-derived TTL.
fn store_dispute_resolution_evidence(
    env: &Env,
    escrow_id: u64,
    evidence_hash: &BytesN<32>,
    escrow: &EscrowEntryV2,
) {
    let key = get_dispute_resolution_evidence_key(escrow_id);
    env.storage().persistent().set(&key, evidence_hash);
    extend_escrow_ttl(env, &key, escrow);
}

fn extend_escrow_ttl(env: &Env, key: &(Symbol, u64), escrow: &EscrowEntryV2) {
    let max_ttl = escrow_ttl_max(env, escrow);
    env.storage().persistent().extend_ttl(key, 100, max_ttl);
}

fn escrow_ttl_max(env: &Env, escrow: &EscrowEntryV2) -> u32 {
    let now = env.ledger().timestamp();
    let active_status = escrow_status(escrow);

    let (seconds, min_ledgers, max_ledgers) = match active_status {
        EscrowStatus::Created | EscrowStatus::Active | EscrowStatus::Disputed => {
            let remaining = escrow.deadline.saturating_sub(now);
            let desired = remaining.saturating_add(86400);
            (desired, 50_000u32, 1_000_000u32)
        }
        EscrowStatus::Completed
        | EscrowStatus::Cancelled
        | EscrowStatus::Resolved
        | EscrowStatus::Expired => (30u64.saturating_mul(86400), 10_000u32, 200_000u32),
    };

    let mut ledgers = seconds_to_ledgers(seconds);
    if ledgers < min_ledgers {
        ledgers = min_ledgers;
    }
    if ledgers > max_ledgers {
        ledgers = max_ledgers;
    }
    ledgers
}

fn seconds_to_ledgers(seconds: u64) -> u32 {
    let ledger_seconds: u64 = 5;
    let ledgers = seconds
        .saturating_add(ledger_seconds.saturating_sub(1))
        .checked_div(ledger_seconds)
        .unwrap_or(0);
    if ledgers > u32::MAX as u64 {
        u32::MAX
    } else {
        ledgers as u32
    }
}

#[cfg(test)]
mod fee_tests;
#[cfg(test)]
mod invariant_tests;
#[cfg(test)]
mod test;
