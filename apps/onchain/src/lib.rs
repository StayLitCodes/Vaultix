#![no_std]
#![allow(unexpected_cfgs)]
use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, token, Address, Env, Symbol,
    Vec,
};

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MilestoneStatus {
    Pending,
    Released,
    Disputed,
}

#[contracttype]
#[derive(Clone, Debug)]
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
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Resolution {
    None,
    Depositor,
    Recipient,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ContractState {
    Active,
    Paused,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Escrow {
    pub depositor: Address,
    pub recipient: Address,
    pub token_address: Address, // NEW: Token contract address
    pub total_amount: i128,
    pub total_released: i128,
    pub milestones: Vec<Milestone>,
    pub status: EscrowStatus,
    pub deadline: u64, // NEW: Deadline for escrow completion
    pub resolution: Resolution,
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
    EscrowAlreadyFunded = 14, // NEW: Prevent double funding
    TokenTransferFailed = 15, // NEW: Token transfer error
    TreasuryNotInitialized = 16,
    InvalidFeeConfiguration = 17,
    AdminNotInitialized = 18,
    AlreadyInitialized = 19,
    InvalidEscrowStatus = 20,
    AlreadyInDispute = 21,
    InvalidWinner = 22,
    ContractPaused = 23,
}

// Platform fee configuration (in basis points: 1 bps = 0.01%)
// Default: 50 bps = 0.5%
const DEFAULT_FEE_BPS: i128 = 50;
const BPS_DENOMINATOR: i128 = 10000;

#[contract]
pub struct VaultixEscrow;

#[contractimpl]
impl VaultixEscrow {
    /// Initializes the contract with treasury address and optional fee configuration.
    ///
    /// # Arguments
    /// * `treasury` - Address that will receive platform fees
    /// * `fee_bps` - Optional fee in basis points (default: 50 bps = 0.5%)
    ///
    /// # Errors
    /// * `InvalidFeeConfiguration` - If fee_bps exceeds 10000 (100%)
    pub fn initialize(env: Env, treasury: Address, fee_bps: Option<i128>) -> Result<(), Error> {
        // Verify treasury address authorization
        treasury.require_auth();

        let fee = fee_bps.unwrap_or(DEFAULT_FEE_BPS);

        // Validate fee is reasonable (max 100%)
        if !(0..=BPS_DENOMINATOR).contains(&fee) {
            return Err(Error::InvalidFeeConfiguration);
        }

        // Store treasury address
        env.storage()
            .instance()
            .set(&symbol_short!("treasury"), &treasury);

        // Store fee configuration
        env.storage()
            .instance()
            .set(&symbol_short!("fee_bps"), &fee);

        Ok(())
    }

    /// Updates the platform fee (admin only).
    ///
    /// # Arguments
    /// * `new_fee_bps` - New fee in basis points
    ///
    /// # Errors
    /// * `TreasuryNotInitialized` - If contract not initialized
    /// * `UnauthorizedAccess` - If caller is not treasury
    /// * `InvalidFeeConfiguration` - If fee exceeds 100%
    pub fn update_fee(env: Env, new_fee_bps: i128) -> Result<(), Error> {
        let treasury: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("treasury"))
            .ok_or(Error::TreasuryNotInitialized)?;

        treasury.require_auth();

        if !(0..=BPS_DENOMINATOR).contains(&new_fee_bps) {
            return Err(Error::InvalidFeeConfiguration);
        }

        env.storage()
            .instance()
            .set(&symbol_short!("fee_bps"), &new_fee_bps);

        Ok(())
    }

    /// Returns the current treasury address and fee configuration.
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

    /// Sets the global paused state (admin only).
    /// When paused, state-changing user operations are blocked.
    /// Read-only functions remain accessible.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), Error> {
        let treasury: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("treasury"))
            .ok_or(Error::TreasuryNotInitialized)?;
        treasury.require_auth();

        let state = if paused {
            ContractState::Paused
        } else {
            ContractState::Active
        };

        env.storage()
            .instance()
            .set(&symbol_short!("state"), &state);

        Ok(())
    }

    /// Initializes the contract with an admin address responsible for dispute resolution.
    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().persistent().has(&admin_storage_key()) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().persistent().set(&admin_storage_key(), &admin);
        Ok(())
    }

    /// Creates a new escrow with milestone-based payment releases.
    /// NOTE: This only creates the escrow structure. Funds must be deposited separately via deposit_funds().
    ///
    /// # Arguments
    /// * `escrow_id` - Unique identifier for the escrow
    /// * `depositor` - Address funding the escrow
    /// * `recipient` - Address receiving milestone payments
    /// * `token_address` - Address of the token contract (e.g., XLM, USDC)
    /// * `milestones` - Vector of milestones defining payment schedule
    /// * `deadline` - Unix timestamp deadline for escrow completion
    ///
    /// # Errors
    /// * `EscrowAlreadyExists` - If escrow_id is already in use
    /// * `VectorTooLarge` - If more than 20 milestones provided
    /// * `InvalidMilestoneAmount` - If any milestone amount is zero or negative
    /// * `SelfDealing` - If depositor and recipient are the same
    pub fn create_escrow(
        env: Env,
        escrow_id: u64,
        depositor: Address,
        recipient: Address,
        token_address: Address,
        milestones: Vec<Milestone>,
        deadline: u64,
    ) -> Result<(), Error> {
        depositor.require_auth();

        ensure_not_paused(&env)?;

        if depositor == recipient {
            return Err(Error::SelfDealing);
        }

        let storage_key = get_storage_key(escrow_id);
        if env.storage().persistent().has(&storage_key) {
            return Err(Error::EscrowAlreadyExists);
        }

        let total_amount = validate_milestones(&milestones)?;

        let mut initialized_milestones = Vec::new(&env);
        for milestone in milestones.iter() {
            let mut m = milestone.clone();
            m.status = MilestoneStatus::Pending;
            initialized_milestones.push_back(m);
        }

        // Create the escrow in Created state (not yet funded)
        let escrow = Escrow {
            depositor: depositor.clone(),
            recipient: recipient.clone(),
            token_address: token_address.clone(),
            total_amount,
            total_released: 0,
            milestones: initialized_milestones,
            status: EscrowStatus::Created, // Initially Created, becomes Active after deposit
            deadline,
            resolution: Resolution::None,
        };

        env.storage().persistent().set(&storage_key, &escrow);

        // Extend TTL for long-term storage
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

        // Emit event
        env.events().publish(
            (symbol_short!("create"), escrow_id, depositor, recipient),
            total_amount,
        );

        Ok(())
    }

    /// Deposits funds into an escrow, transitioning it from Created to Active.
    /// The depositor must have approved this contract to spend the required amount.
    ///
    /// # Arguments
    /// * `escrow_id` - Identifier of the escrow to fund
    ///
    /// # Errors
    /// * `EscrowNotFound` - If escrow doesn't exist
    /// * `UnauthorizedAccess` - If caller is not the depositor
    /// * `EscrowAlreadyFunded` - If escrow is already in Active state
    /// * `TokenTransferFailed` - If token transfer fails
    pub fn deposit_funds(env: Env, escrow_id: u64) -> Result<(), Error> {
        let storage_key = get_storage_key(escrow_id);

        ensure_not_paused(&env)?;

        // Load escrow from storage
        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;

        // Verify authorization - only depositor can fund
        escrow.depositor.require_auth();

        // Check escrow hasn't already been funded
        if escrow.status != EscrowStatus::Created {
            return Err(Error::EscrowAlreadyFunded);
        }

        // Initialize token client for the specified token
        let token_client = token::Client::new(&env, &escrow.token_address);

        // Transfer tokens from depositor to contract
        // NOTE: Depositor must have approved this contract to spend their tokens
        token_client.transfer_from(
            &env.current_contract_address(), // spender (this contract)
            &escrow.depositor,               // from (depositor's address)
            &env.current_contract_address(), // to (contract's address - holds in escrow)
            &escrow.total_amount,            // amount to transfer
        );

        // Update escrow status to Active
        escrow.status = EscrowStatus::Active;

        // Save updated escrow
        env.storage().persistent().set(&storage_key, &escrow);

        // Extend TTL
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);
        Ok(())
    }

    /// Retrieves escrow details (read-only)
    pub fn get_escrow(env: Env, escrow_id: u64) -> Result<Escrow, Error> {
        let storage_key = get_storage_key(escrow_id);
        env.storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)
    }

    /// Read-only helper to fetch escrow status
    pub fn get_state(env: Env, escrow_id: u64) -> Result<EscrowStatus, Error> {
        let escrow = Self::get_escrow(env, escrow_id)?;
        Ok(escrow.status)
    }

    /// Releases a specific milestone payment to the recipient with platform fee deduction.
    ///
    /// # Arguments
    /// * `escrow_id` - Identifier of the escrow
    /// * `milestone_index` - Index of the milestone to release
    ///
    /// # Errors
    /// * `EscrowNotFound` - If escrow doesn't exist
    /// * `UnauthorizedAccess` - If caller is not the depositor
    /// * `EscrowNotActive` - If escrow is not in Active state
    /// * `MilestoneNotFound` - If index is out of bounds
    /// * `MilestoneAlreadyReleased` - If milestone was already released
    /// * `TreasuryNotInitialized` - If contract not initialized
    ///
    /// # Fee Calculation
    /// Platform fee is calculated using basis points: fee = (amount * fee_bps) / 10000
    /// The recipient receives: amount - fee
    /// The treasury receives: fee
    /// Releases a specific milestone payment to the recipient (depositor-driven path).
    pub fn release_milestone(env: Env, escrow_id: u64, milestone_index: u32) -> Result<(), Error> {
        let storage_key = get_storage_key(escrow_id);

        ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;

        // Verify authorization - only depositor can release funds
        escrow.depositor.require_auth();

        // Check escrow is active (funds deposited)
        if escrow.status != EscrowStatus::Active {
            return Err(Error::EscrowNotActive);
        }

        if milestone_index >= escrow.milestones.len() {
            return Err(Error::MilestoneNotFound);
        }

        let mut milestone = escrow
            .milestones
            .get(milestone_index)
            .ok_or(Error::MilestoneNotFound)?;

        // CHECK IF ALREADY RELEASED FIRST - BEFORE ANY TOKEN OPERATIONS
        if milestone.status == MilestoneStatus::Released {
            return Err(Error::MilestoneAlreadyReleased);
        }

        // Get treasury and fee configuration
        let (treasury, fee_bps) = Self::get_config(env.clone())?;

        // Calculate platform fee using integer math
        // fee = (amount * fee_bps) / 10000
        let fee = calculate_fee(milestone.amount, fee_bps)?;
        let payout = milestone
            .amount
            .checked_sub(fee)
            .ok_or(Error::InvalidMilestoneAmount)?;

        // Create token client for transfers
        let token_client = token::Client::new(&env, &escrow.token_address);

        // Transfer payout to recipient (seller)
        token_client.transfer(&env.current_contract_address(), &escrow.recipient, &payout);

        // Transfer fee to treasury (only if fee > 0)
        if fee > 0 {
            token_client.transfer(&env.current_contract_address(), &treasury, &fee);

            // Emit event for fee collection
            #[allow(deprecated)]
            env.events().publish(
                (symbol_short!("fee_coll"), escrow_id, milestone_index),
                (fee, treasury.clone()),
            );
        }

        milestone.status = MilestoneStatus::Released;
        escrow.milestones.set(milestone_index, milestone.clone());

        escrow.total_released = escrow
            .total_released
            .checked_add(milestone.amount)
            .ok_or(Error::InvalidMilestoneAmount)?;

        env.storage().persistent().set(&storage_key, &escrow);

        // Extend TTL
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

        // Emit event for milestone release
        #[allow(deprecated)]
        env.events().publish(
            (symbol_short!("released"), escrow_id, milestone_index),
            (payout, escrow.recipient.clone()),
        );

        Ok(())
    }

    /// Buyer confirms delivery and releases a milestone to the recipient (buyer-driven path).
    pub fn confirm_delivery(
        env: Env,
        escrow_id: u64,
        milestone_index: u32,
        buyer: Address,
    ) -> Result<(), Error> {
        let storage_key = get_storage_key(escrow_id);

        ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;

        buyer.require_auth();

        if escrow.depositor != buyer {
            return Err(Error::UnauthorizedAccess);
        }

        if escrow.status != EscrowStatus::Active {
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

        milestone.status = MilestoneStatus::Released;
        escrow.milestones.set(milestone_index, milestone.clone());

        escrow.total_released = escrow
            .total_released
            .checked_add(milestone.amount)
            .ok_or(Error::InvalidMilestoneAmount)?;

        let token_client = token::Client::new(&env, &escrow.token_address);
        token_client.transfer(
            &env.current_contract_address(),
            &escrow.recipient,
            &milestone.amount,
        );

        env.storage().persistent().set(&storage_key, &escrow);

        Ok(())
    }

    /// Raises a dispute on an active escrow. Either party (depositor or recipient) may invoke this.
    pub fn raise_dispute(env: Env, escrow_id: u64, caller: Address) -> Result<(), Error> {
        let storage_key = get_storage_key(escrow_id);

        ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;

        if caller != escrow.depositor && caller != escrow.recipient {
            return Err(Error::UnauthorizedAccess);
        }
        caller.require_auth();

        if escrow.status == EscrowStatus::Disputed {
            return Err(Error::AlreadyInDispute);
        }
        if escrow.status != EscrowStatus::Active && escrow.status != EscrowStatus::Created {
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
        escrow.status = EscrowStatus::Disputed;
        escrow.resolution = Resolution::None;
        env.storage().persistent().set(&storage_key, &escrow);

        Ok(())
    }

    /// Resolves an active dispute by directing funds to the chosen party. Only the admin may call this.
    pub fn resolve_dispute(env: Env, escrow_id: u64, winner: Address) -> Result<(), Error> {
        let admin = get_admin(&env)?;
        admin.require_auth();

        let storage_key = get_storage_key(escrow_id);

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;

        if escrow.status != EscrowStatus::Disputed {
            return Err(Error::InvalidEscrowStatus);
        }

        if winner != escrow.depositor && winner != escrow.recipient {
            return Err(Error::InvalidWinner);
        }

        let outstanding = escrow
            .total_amount
            .checked_sub(escrow.total_released)
            .ok_or(Error::InvalidMilestoneAmount)?;

        let token_client = token::Client::new(&env, &escrow.token_address);

        if winner == escrow.recipient {
            let mut updated_milestones = Vec::new(&env);
            for milestone in escrow.milestones.iter() {
                let mut m = milestone.clone();
                if m.status != MilestoneStatus::Released {
                    m.status = MilestoneStatus::Released;
                }
                updated_milestones.push_back(m);
            }
            escrow.milestones = updated_milestones;
            escrow.total_released = escrow.total_amount;
            escrow.resolution = Resolution::Recipient;

            if outstanding > 0 {
                token_client.transfer(
                    &env.current_contract_address(),
                    &escrow.recipient,
                    &outstanding,
                );
            }
        } else {
            let mut updated_milestones = Vec::new(&env);
            for milestone in escrow.milestones.iter() {
                let mut m = milestone.clone();
                if m.status == MilestoneStatus::Pending || m.status == MilestoneStatus::Disputed {
                    m.status = MilestoneStatus::Disputed;
                }
                updated_milestones.push_back(m);
            }
            escrow.milestones = updated_milestones;
            escrow.resolution = Resolution::Depositor;

            if outstanding > 0 {
                token_client.transfer(
                    &env.current_contract_address(),
                    &escrow.depositor,
                    &outstanding,
                );
            }
        }

        escrow.status = EscrowStatus::Resolved;
        env.storage().persistent().set(&storage_key, &escrow);

        Ok(())
    }

    /// Cancels an escrow before any milestones are released.
    /// Returns all funds to the depositor.
    ///
    /// # Arguments
    /// * `escrow_id` - Identifier of the escrow
    ///
    /// # Errors
    /// * `EscrowNotFound` - If escrow doesn't exist
    /// * `UnauthorizedAccess` - If caller is not the depositor
    /// * `MilestoneAlreadyReleased` - If any milestone has been released
    pub fn cancel_escrow(env: Env, escrow_id: u64) -> Result<(), Error> {
        let storage_key = get_storage_key(escrow_id);

        ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;

        escrow.depositor.require_auth();

        if escrow.status != EscrowStatus::Active && escrow.status != EscrowStatus::Created {
            return Err(Error::InvalidEscrowStatus);
        }

        if escrow.total_released > 0 {
            return Err(Error::MilestoneAlreadyReleased);
        }

        // If escrow was funded (Active status), refund the depositor
        if escrow.status == EscrowStatus::Active {
            let token_client = token::Client::new(&env, &escrow.token_address);

            // Transfer all funds back to depositor
            token_client.transfer(
                &env.current_contract_address(), // from (contract)
                &escrow.depositor,               // to (depositor)
                &escrow.total_amount,            // full amount
            );
        }

        escrow.status = EscrowStatus::Cancelled;
        env.storage().persistent().set(&storage_key, &escrow);

        // Extend TTL
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

        Ok(())
    }

    /// Marks an escrow as completed after all milestones are released.
    pub fn complete_escrow(env: Env, escrow_id: u64) -> Result<(), Error> {
        let storage_key = get_storage_key(escrow_id);

        ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;

        escrow.depositor.require_auth();

        if escrow.status != EscrowStatus::Active {
            return Err(Error::InvalidEscrowStatus);
        }

        if !verify_all_released(&escrow.milestones) {
            return Err(Error::EscrowNotActive);
        }

        escrow.status = EscrowStatus::Completed;
        env.storage().persistent().set(&storage_key, &escrow);

        // Extend TTL
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

        Ok(())
    }
}

fn get_storage_key(escrow_id: u64) -> (Symbol, u64) {
    (symbol_short!("escrow"), escrow_id)
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

fn get_admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .persistent()
        .get(&admin_storage_key())
        .ok_or(Error::AdminNotInitialized)
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

/// Calculates platform fee using basis points with integer math.
///
/// # Arguments
/// * `amount` - The milestone amount
/// * `fee_bps` - Fee in basis points (1 bps = 0.01%)
///
/// # Returns
/// The calculated fee amount
///
/// # Errors
/// * `InvalidMilestoneAmount` - If calculation overflows
///
/// # Example
/// For amount = 10000 and fee_bps = 50 (0.5%):
/// fee = (10000 * 50) / 10000 = 50
fn calculate_fee(amount: i128, fee_bps: i128) -> Result<i128, Error> {
    // Calculate: (amount * fee_bps) / BPS_DENOMINATOR
    let fee_numerator = amount
        .checked_mul(fee_bps)
        .ok_or(Error::InvalidMilestoneAmount)?;

    let fee = fee_numerator
        .checked_div(BPS_DENOMINATOR)
        .ok_or(Error::InvalidMilestoneAmount)?;

    Ok(fee)
}
#[cfg(test)]
mod test;
