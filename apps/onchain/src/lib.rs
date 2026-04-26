mod auth;

#![no_std]
#![allow(unexpected_cfgs)]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    Symbol, Vec,
};

use crate::auth::{require_admin, require_arbitrator, require_depositor, require_operator, require_party};

impl VaultixEscrow {
    /// Secure contract upgrade function (Admin Proxy).
    /// WARNING: Future upgrades MUST preserve storage layout (structs, enums, keys) to avoid corrupting state.
    /// Only admin can call. Emits ContractUpgraded event before upgrade.
    pub fn upgrade(env: Env, new_wasm_hash: [u8; 32]) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        require_admin(&env, &admin)?;

        let hash_bytes = soroban_sdk::BytesN::<32>::from_array(&env, &new_wasm_hash);

        // Emit ContractUpgraded event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "ContractUpgraded"),
            ),
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
    pub metadata_hash: BytesN<32>, // IPFS metadata hash for the escrow agreement
}

#[contracttype]
#[derive(Clone, Debug)]
struct EscrowEntryV2 {
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
    pub operator: Address,
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
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct DisputeRaisedEvent {
    pub escrow_id: u64,
    pub raised_by: Address,
    pub depositor: Address,
    pub recipient: Address,
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
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, PartialEq)]
pub struct EscrowCompletedEvent {
    pub escrow_id: u64,
    pub completed_by: Address,
    pub total_released: i128,
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
}

const DEFAULT_FEE_BPS: i128 = 50;
const BPS_DENOMINATOR: i128 = 10000;
const MAX_BATCH_SIZE: u32 = 20;
const EVENT_NAMESPACE: &str = "Vaultix";
const EVENT_SCHEMA_VERSION: &str = "v1";

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
    pub fn initialize(env: Env, treasury: Address, fee_bps: Option<i128>) -> Result<(), Error> {
        require_operator(&env, &treasury)?;

        let fee = fee_bps.unwrap_or(DEFAULT_FEE_BPS);

        if !(0..=BPS_DENOMINATOR).contains(&fee) {
            return Err(Error::InvalidFeeConfiguration);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("treasury"), &treasury);
        env.storage()
            .instance()
            .set(&symbol_short!("fee_bps"), &fee);

        let timestamp = current_timestamp(&env);

        env.events().publish(
            event_topic(&env, "RoleUpdated"),
            RoleUpdatedEvent {
                role: Role::Treasury,
                had_old_address: false,
                old_address: treasury.clone(),
                new_address: treasury.clone(),
                timestamp,
            },
        );

        env.events().publish(
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

        Ok(())
    }

    pub fn update_fee(env: Env, new_fee_bps: i128) -> Result<(), Error> {
        let operator = get_operator(&env)?;
        require_operator(&env, &operator)?;

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

        env.events().publish(
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
        require_admin(&env, &treasury)?;

        if !(0..=BPS_DENOMINATOR).contains(&fee_bps) {
            return Err(Error::InvalidFeeConfiguration);
        }

        let token_fee_key = get_token_fee_key(&token_address);
        let old_fee: Option<i128> = env.storage().persistent().get(&token_fee_key);

        env.storage().persistent().set(&token_fee_key, &fee_bps);
        env.storage()
            .persistent()
            .extend_ttl(&token_fee_key, 100, 2_000_000);

        env.events().publish(
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
        require_admin(&env, &treasury)?;

        if !(0..=BPS_DENOMINATOR).contains(&fee_bps) {
            return Err(Error::InvalidFeeConfiguration);
        }

        if let Ok(mut escrow) = load_escrow_entry_v2(&env, escrow_id) {
            let old_fee = escrow_fee_override_opt(&escrow).unwrap_or(DEFAULT_FEE_BPS);
            escrow.fee_override_bps = fee_bps;
            store_escrow_entry_v2(&env, escrow_id, &escrow);

            env.events().publish(
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

        env.events().publish(
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
        let operator = get_operator(&env)?;
        require_operator(&env, &operator)?;

        let state = if paused {
            ContractState::Paused
        } else {
            ContractState::Active
        };
        env.storage()
            .instance()
            .set(&symbol_short!("state"), &state);

        env.events().publish(
            event_topic(&env, "PausedToggled"),
            PausedToggledEvent {
                paused,
                operator,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn init(
        env: Env,
        admin: Address,
        operator: Address,
        arbitrator: Address,
    ) -> Result<(), Error> {
        if env.storage().persistent().has(&admin_storage_key()) {
            return Err(Error::AlreadyInitialized);
        }

        require_admin(&env, &admin)?;

        env.storage().persistent().set(&admin_storage_key(), &admin);
        env.storage()
            .persistent()
            .set(&operator_storage_key(), &operator);
        env.storage()
            .persistent()
            .set(&arbitrator_storage_key(), &arbitrator);
        extend_roles_ttl(&env);

        let timestamp = current_timestamp(&env);

        env.events().publish(
            event_topic(&env, "RoleUpdated"),
            RoleUpdatedEvent {
                role: Role::Admin,
                had_old_address: false,
                old_address: admin.clone(),
                new_address: admin,
                timestamp,
            },
        );
        env.events().publish(
            event_topic(&env, "RoleUpdated"),
            RoleUpdatedEvent {
                role: Role::Operator,
                had_old_address: false,
                old_address: operator.clone(),
                new_address: operator,
                timestamp,
            },
        );
        env.events().publish(
            event_topic(&env, "RoleUpdated"),
            RoleUpdatedEvent {
                role: Role::Arbitrator,
                had_old_address: false,
                old_address: arbitrator.clone(),
                new_address: arbitrator,
                timestamp,
            },
        );

        Ok(())
    }

    /// Configure the threshold amount and required signatures for an escrow
    /// Only the depositor can call this function
    pub fn configure_multisig(
        env: Env,
        escrow_id: u64,
        threshold_amount: i128,
        required_signatures: u32,
    ) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        require_depositor(&env, &escrow.depositor, &escrow.depositor)?;

        // Only allow configuration if the escrow hasn't been funded yet
        if escrow_status(&escrow) != EscrowStatus::Created {
            return Err(Error::InvalidEscrowStatus);
        }

        escrow.threshold_amount = threshold_amount;
        escrow.required_signatures = required_signatures;

        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Emit event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "MultisigConfigured"),
                escrow_id,
            ),
            (threshold_amount, required_signatures),
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
        depositor.require_auth();
        ensure_not_paused(&env)?;

        if depositor == recipient {
            return Err(Error::SelfDealing);
        }

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
            threshold_amount: 10000,
            required_signatures: 1,
            collected_signatures: Vec::new(&env),
            fee_override_bps,
            metadata_hash: metadata_hash.clone(),
        };

        store_escrow_entry_v2(&env, escrow_id, &escrow);

        env.events().publish(
            event_topic(&env, "EscrowCreated"),
            EscrowCreatedEvent {
                escrow_id,
                depositor,
                recipient,
                token_address,
                total_amount,
                deadline,
                metadata_hash,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    pub fn create_escrows_batch(env: Env, requests: Vec<CreateEscrowRequest>) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        if requests.len() > MAX_BATCH_SIZE {
            return Err(Error::VectorTooLarge);
        }

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
                threshold_amount: 10000,
                required_signatures: 1,
                collected_signatures: Vec::new(&env),
                fee_override_bps,
                metadata_hash,
            };

            pending_entries.push_back((escrow_id, escrow, fee_override_bps >= 0));

            created_items.push_back(EscrowCreatedBatchEventItem {
                escrow_id,
                depositor,
                recipient,
                token_address,
                total_amount,
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

            store_escrow_entry_v2(&env, escrow_id, &escrow);
        }

        if !created_items.is_empty() {
            env.events().publish(
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
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;
        require_depositor(&env, &escrow.depositor, &escrow.depositor)?;

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

        set_escrow_status(&mut escrow, EscrowStatus::Active);
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        env.events().publish(
            event_topic(&env, "FundsDeposited"),
            FundsDepositedEvent {
                escrow_id,
                depositor: escrow.depositor.clone(),
                recipient: escrow.recipient.clone(),
                token_address: escrow.token_address.clone(),
                total_amount: escrow.total_amount,
                timestamp: current_timestamp(&env),
            },
        );

        Ok(())
    }

    /// Collect a signature for releasing funds
    /// The signature can come from either the depositor or a designated third party
    pub fn collect_signature(env: Env, escrow_id: u64, signer: Address) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        // Require authentication from the signer
        signer.require_auth();

        // Check if this signer has already signed
        for existing_signer in escrow.collected_signatures.iter() {
            if existing_signer == signer {
                return Ok(()); // Idempotent - no error if already signed
            }
        }

        // Add the new signature
        escrow.collected_signatures.push_back(signer.clone());

        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Emit event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "SignatureCollected"),
                escrow_id,
            ),
            signer,
        );

        Ok(())
    }

    pub fn get_escrow(env: Env, escrow_id: u64) -> Result<Escrow, Error> {
        let escrow = load_escrow_entry_v2(&env, escrow_id)?;
        Ok(escrow_entry_to_public(escrow))
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
            // Check if we have enough signatures
            if escrow.collected_signatures.len() < escrow.required_signatures {
                return Err(Error::UnauthorizedAccess);
            }
        } else {
            // For amounts at or below threshold, only depositor can release
            require_depositor(&env, &escrow.depositor, &escrow.depositor)?;
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
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        env.events().publish(
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
            // Check if we have enough signatures
            if escrow.collected_signatures.len() < escrow.required_signatures {
                return Err(Error::UnauthorizedAccess);
            }
        }

        let release = release_pending_milestone(&env, &mut escrow, milestone_index)?;
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        env.events().publish(
            event_topic(&env, "DeliveryConfirmed"),
            DeliveryConfirmedEvent {
                escrow_id,
                milestone_index,
                confirmed_by: buyer,
                depositor: escrow.depositor.clone(),
                recipient: esc
                