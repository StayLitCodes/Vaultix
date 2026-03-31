// lib.rs
#![no_std]
#![allow(unexpected_cfgs)]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, BytesN, Env,
    Symbol, Vec,
};

impl VaultixEscrow {
    /// Secure contract upgrade function (Admin Proxy).
    /// WARNING: Future upgrades MUST preserve storage layout (structs, enums, keys) to avoid corrupting state.
    /// Only admin can call. Emits ContractUpgraded event before upgrade.
    pub fn upgrade(env: Env, new_wasm_hash: [u8; 32]) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

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

#[contract]
pub struct VaultixEscrow;

#[contractimpl]
impl VaultixEscrow {
    pub fn initialize(env: Env, treasury: Address, fee_bps: Option<i128>) -> Result<(), Error> {
        treasury.require_auth();

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

        let vaultix_topic = Symbol::new(&env, "Vaultix");

        // Emit RoleUpdated(role, old_addr, new_addr) - using Option for old_addr
        env.events().publish(
            (
                vaultix_topic.clone(),
                Symbol::new(&env, "RoleUpdated"),
                Symbol::new(&env, "Treasury"),
            ),
            (Option::<Address>::None, treasury.clone()),
        );

        // Emit FeeUpdated(scope, key, old_fee, new_fee)
        env.events().publish(
            (vaultix_topic, Symbol::new(&env, "FeeUpdated")),
            (
                Symbol::new(&env, "Global"),
                Symbol::new(&env, "PlatformFee"),
                0i128,
                fee,
            ),
        );

        Ok(())
    }

    pub fn update_fee(env: Env, new_fee_bps: i128) -> Result<(), Error> {
        let operator = get_operator(&env)?;
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

        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "FeeUpdated"),
            ),
            (
                Symbol::new(&env, "Global"),
                Symbol::new(&env, "PlatformFee"),
                old_fee,
                new_fee_bps,
            ),
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

        // Emit FeeUpdated event for token-level override
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "FeeUpdated"),
            ),
            (
                Symbol::new(&env, "Token"),
                token_address.clone(),
                old_fee.unwrap_or(DEFAULT_FEE_BPS),
                fee_bps,
            ),
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
            store_escrow_entry_v2(&env, escrow_id, &escrow);

            env.events().publish(
                (
                    Symbol::new(&env, "Vaultix"),
                    Symbol::new(&env, "FeeUpdated"),
                ),
                (Symbol::new(&env, "Escrow"), escrow_id, old_fee, fee_bps),
            );

            return Ok(());
        }

        let escrow_fee_key = get_escrow_fee_key(escrow_id);
        let old_fee: Option<i128> = env.storage().persistent().get(&escrow_fee_key);

        env.storage().persistent().set(&escrow_fee_key, &fee_bps);
        env.storage()
            .persistent()
            .extend_ttl(&escrow_fee_key, 100, 500_000);

        // Emit FeeUpdated event for escrow-level override
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "FeeUpdated"),
            ),
            (
                Symbol::new(&env, "Escrow"),
                escrow_id,
                old_fee.unwrap_or(DEFAULT_FEE_BPS),
                fee_bps,
            ),
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
        operator.require_auth();

        let state = if paused {
            ContractState::Paused
        } else {
            ContractState::Active
        };
        env.storage()
            .instance()
            .set(&symbol_short!("state"), &state);

        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "PausedStateChanged"),
            ),
            (paused, operator),
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

        admin.require_auth();

        env.storage().persistent().set(&admin_storage_key(), &admin);
        env.storage()
            .persistent()
            .set(&operator_storage_key(), &operator);
        env.storage()
            .persistent()
            .set(&arbitrator_storage_key(), &arbitrator);
        extend_roles_ttl(&env);

        let vaultix_topic = Symbol::new(&env, "Vaultix");

        env.events().publish(
            (
                vaultix_topic.clone(),
                Symbol::new(&env, "RoleUpdated"),
                Symbol::new(&env, "Admin"),
            ),
            (Option::<Address>::None, admin),
        );
        env.events().publish(
            (
                vaultix_topic.clone(),
                Symbol::new(&env, "RoleUpdated"),
                Symbol::new(&env, "Operator"),
            ),
            (Option::<Address>::None, operator),
        );
        env.events().publish(
            (
                vaultix_topic,
                Symbol::new(&env, "RoleUpdated"),
                Symbol::new(&env, "Arbitrator"),
            ),
            (Option::<Address>::None, arbitrator),
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

        escrow.depositor.require_auth();

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

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "EscrowCreated"),
                escrow_id,
            ),
            (
                depositor,
                recipient,
                token_address,
                total_amount,
                deadline,
                metadata_hash,
            ),
        );

        Ok(())
    }

    pub fn create_escrows_batch(env: Env, requests: Vec<CreateEscrowRequest>) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        if requests.len() > 20 {
            return Err(Error::VectorTooLarge);
        }

        let mut created_items: Vec<EscrowCreatedBatchItem> = Vec::new(&env);
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

            created_items.push_back(EscrowCreatedBatchItem {
                escrow_id,
                depositor,
                recipient,
                token_address,
                total_amount,
                deadline,
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
                (
                    Symbol::new(&env, "Vaultix"),
                    Symbol::new(&env, "EscrowsCreatedBatch"),
                ),
                created_items,
            );
        }

        Ok(())
    }

    pub fn deposit_funds(env: Env, escrow_id: u64) -> Result<(), Error> {
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

        set_escrow_status(&mut escrow, EscrowStatus::Active);
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "EscrowFunded"),
                escrow_id,
            ),
            escrow.total_amount,
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
            escrow.depositor.require_auth();
        }

        if escrow_status(&escrow) != EscrowStatus::Active {
            return Err(Error::EscrowNotActive);
        }
        if milestone_index >= escrow.milestones.len() {
            return Err(Error::MilestoneNotFound);
        }

        let mut milestone = escrow
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;
        if milestone.status == MilestoneStatus::Released {
            return Err(Error::MilestoneAlreadyReleased);
        }

        let (treasury, _) = Self::get_config(env.clone())?;
        let fee_bps = resolve_fee_with_escrow_override(
            &env,
            &escrow.token_address,
            escrow_fee_override_opt(&escrow),
        )?;
        let fee = calculate_fee(milestone.amount, fee_bps)?;
        let payout = milestone
            .amount
            .checked_sub(fee)
            .ok_or(Error::InvalidMilestoneAmount)?;

        let token_client = token::Client::new(&env, &escrow.token_address);
        safe_transfer(
            &token_client,
            &env.current_contract_address(),
            &escrow.recipient,
            payout,
        )?;

        if fee > 0 {
            safe_transfer(
                &token_client,
                &env.current_contract_address(),
                &treasury,
                fee,
            )?;
        }

        milestone.status = MilestoneStatus::Released;
        escrow.milestones.set(milestone_index, milestone.clone());

        escrow.total_released = escrow
            .total_released
            .checked_add(milestone.amount)
            .ok_or(Error::InvalidMilestoneAmount)?;

        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "MilestoneReleased"),
                escrow_id,
                milestone_index,
            ),
            (payout, fee),
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

        let mut milestone = escrow
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;
        if milestone.status == MilestoneStatus::Released {
            return Err(Error::MilestoneAlreadyReleased);
        }

        // For amounts exceeding the threshold, check multi-signature requirements
        if milestone.amount > escrow.threshold_amount {
            // Check if we have enough signatures
            if escrow.collected_signatures.len() < escrow.required_signatures {
                return Err(Error::UnauthorizedAccess);
            }
        }

        milestone.status = MilestoneStatus::Released;
        escrow.milestones.set(milestone_index, milestone.clone());

        escrow.total_released = escrow
            .total_released
            .checked_add(milestone.amount)
            .ok_or(Error::InvalidMilestoneAmount)?;

        let token_client = token::Client::new(&env, &escrow.token_address);
        safe_transfer(
            &token_client,
            &env.current_contract_address(),
            &escrow.recipient,
            milestone.amount,
        )?;

        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "MilestoneReleased"),
                escrow_id,
                milestone_index,
            ),
            (milestone.amount, 0i128),
        );

        Ok(())
    }

    pub fn raise_dispute(env: Env, escrow_id: u64, caller: Address) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        if caller != escrow.depositor && caller != escrow.recipient {
            return Err(Error::UnauthorizedAccess);
        }
        caller.require_auth();

        if escrow_status(&escrow) == EscrowStatus::Disputed {
            return Err(Error::AlreadyInDispute);
        }
        if escrow_status(&escrow) != EscrowStatus::Active
            && escrow_status(&escrow) != EscrowStatus::Created
        {
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
        set_escrow_status(&mut escrow, EscrowStatus::Disputed);
        set_escrow_resolution(&mut escrow, Resolution::None);
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "DisputeRaised"),
                escrow_id,
            ),
            caller,
        );

        Ok(())
    }

    pub fn resolve_dispute(
        env: Env,
        escrow_id: u64,
        winner: Address,
        split_winner_amount: Option<i128>,
    ) -> Result<(), Error> {
        let arbitrator = get_arbitrator(&env)?;
        arbitrator.require_auth();

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;

        if escrow_status(&escrow) != EscrowStatus::Disputed {
            return Err(Error::InvalidEscrowStatus);
        }
        if winner != escrow.depositor && winner != escrow.recipient {
            return Err(Error::InvalidWinner);
        }

        let outstanding = escrow
            .total_amount
            .checked_sub(escrow.total_released)
            .ok_or(Error::InvalidMilestoneAmount)?;

        if outstanding < 0 {
            return Err(Error::InvalidMilestoneAmount);
        }

        let other = if winner == escrow.depositor {
            escrow.recipient.clone()
        } else {
            escrow.depositor.clone()
        };

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
        set_escrow_status(&mut escrow, EscrowStatus::Resolved);
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "DisputeResolved"),
                escrow_id,
            ),
            (winner, amount_to_winner, amount_to_other),
        );

        Ok(())
    }

    pub fn cancel_escrow(env: Env, escrow_id: u64) -> Result<(), Error> {
        ensure_not_paused(&env)?;

        let mut escrow = load_escrow_entry_v2(&env, escrow_id)?;
        escrow.depositor.require_auth();

        // Debug: emit start of cancel operation
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "CancelStart"),
                escrow_id,
            ),
            (
                escrow.total_amount,
                escrow.total_released,
                escrow_status(&escrow),
            ),
        );

        if escrow_status(&escrow) != EscrowStatus::Active
            && escrow_status(&escrow) != EscrowStatus::Created
        {
            return Err(Error::InvalidEscrowStatus);
        }
        if escrow.total_released > 0 {
            return Err(Error::MilestoneAlreadyReleased);
        }

        if escrow_status(&escrow) == EscrowStatus::Active {
            let token_client = token::Client::new(&env, &escrow.token_address);
            let refund_amount = if let Ok((treasury, _)) = Self::get_config(env.clone()) {
                let fee_bps = resolve_fee_with_escrow_override(
                    &env,
                    &escrow.token_address,
                    escrow_fee_override_opt(&escrow),
                )?;
                let fee = calculate_fee(escrow.total_amount, fee_bps)?;
                // Debug: fee resolved
                env.events().publish(
                    (
                        Symbol::new(&env, "Vaultix"),
                        Symbol::new(&env, "FeeResolved"),
                        escrow_id,
                    ),
                    (fee_bps, fee),
                );
                // Emit debug events to help trace panics in tests
                env.events().publish(
                    (
                        Symbol::new(&env, "Vaultix"),
                        Symbol::new(&env, "FeeTransferAttempt"),
                        escrow_id,
                    ),
                    (fee,),
                );
                if fee > 0 {
                    safe_transfer(
                        &token_client,
                        &env.current_contract_address(),
                        &treasury,
                        fee,
                    )?;
                }
                let refund = escrow
                    .total_amount
                    .checked_sub(fee)
                    .ok_or(Error::InvalidMilestoneAmount)?;
                env.events().publish(
                    (
                        Symbol::new(&env, "Vaultix"),
                        Symbol::new(&env, "RefundAmountComputed"),
                        escrow_id,
                    ),
                    (refund,),
                );
                refund
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

        set_escrow_status(&mut escrow, EscrowStatus::Cancelled);
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "EscrowCancelled"),
                escrow_id,
            ),
            escrow.depositor.clone(),
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

        set_escrow_status(&mut escrow, EscrowStatus::Completed);
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "EscrowCompleted"),
                escrow_id,
            ),
            (),
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

        // Update escrow state
        set_escrow_status(&mut escrow, EscrowStatus::Expired);
        escrow.total_released = escrow.total_amount;
        store_escrow_entry_v2(&env, escrow_id, &escrow);

        // Emit RefundEvent
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "RefundExpired"),
                escrow_id,
            ),
            (escrow.depositor.clone(), refund_amount, current_time),
        );

        Ok(())
    }
}

fn get_storage_key_legacy(escrow_id: u64) -> (Symbol, u64) {
    (symbol_short!("escrow"), escrow_id)
}

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

fn admin_storage_key() -> Symbol {
    symbol_short!("admin")
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

fn get_admin(env: &Env) -> Result<Address, Error> {
    let admin = env
        .storage()
        .persistent()
        .get(&admin_storage_key())
        .ok_or(Error::AdminNotInitialized)?;
    extend_roles_ttl(env);
    Ok(admin)
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

fn get_operator(env: &Env) -> Result<Address, Error> {
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

fn get_arbitrator(env: &Env) -> Result<Address, Error> {
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

fn set_escrow_status(escrow: &mut EscrowEntryV2, status: EscrowStatus) {
    let resolution = unpack_escrow_resolution(escrow.packed_state);
    escrow.packed_state = pack_escrow_state(status, resolution);
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

fn store_escrow_entry_v2(env: &Env, escrow_id: u64, escrow: &EscrowEntryV2) {
    let key = get_storage_key_v2(escrow_id);
    env.storage().persistent().set(&key, escrow);
    extend_escrow_ttl(env, &key, escrow);
}

fn load_escrow_entry_v2(env: &Env, escrow_id: u64) -> Result<EscrowEntryV2, Error> {
    let v2_key = get_storage_key_v2(escrow_id);
    if let Some(v2) = env
        .storage()
        .persistent()
        .get::<(Symbol, u64), EscrowEntryV2>(&v2_key)
    {
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

    let v2 = EscrowEntryV2 {
        depositor: legacy.depositor,
        recipient: legacy.recipient,
        token_address: legacy.token_address,
        total_amount: legacy.total_amount,
        total_released: legacy.total_released,
        milestones: legacy.milestones,
        packed_state: pack_escrow_state(legacy.status, legacy.resolution),
        deadline: legacy.deadline,
        threshold_amount: legacy.threshold_amount,
        required_signatures: legacy.required_signatures,
        collected_signatures: legacy.collected_signatures,
        fee_override_bps,
        metadata_hash: BytesN::from_array(env, &[0u8; 32]),
    };

    env.storage().persistent().remove(&legacy_key);
    if fee_override_bps >= 0 {
        env.storage()
            .persistent()
            .remove(&get_escrow_fee_key(escrow_id));
    }

    store_escrow_entry_v2(env, escrow_id, &v2);
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
    }
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
mod test;
