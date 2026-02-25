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
    pub token_address: Address,
    pub total_amount: i128,
    pub total_released: i128,
    pub milestones: Vec<Milestone>,
    pub status: EscrowStatus,
    pub deadline: u64,
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
        let treasury: Address = env
            .storage()
            .instance()
            .get(&symbol_short!("treasury"))
            .ok_or(Error::TreasuryNotInitialized)?;
        treasury.require_auth();

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

        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "PausedStateChanged"),
            ),
            (paused, treasury),
        );

        Ok(())
    }

    pub fn init(env: Env, admin: Address) -> Result<(), Error> {
        if env.storage().persistent().has(&admin_storage_key()) {
            return Err(Error::AlreadyInitialized);
        }

        admin.require_auth();
        env.storage().persistent().set(&admin_storage_key(), &admin);

        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "RoleUpdated"),
                Symbol::new(&env, "Admin"),
            ),
            (Option::<Address>::None, admin),
        );

        Ok(())
    }

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

        let escrow = Escrow {
            depositor: depositor.clone(),
            recipient: recipient.clone(),
            token_address: token_address.clone(),
            total_amount,
            total_released: 0,
            milestones: initialized_milestones,
            status: EscrowStatus::Created,
            deadline,
            resolution: Resolution::None,
        };

        env.storage().persistent().set(&storage_key, &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "EscrowCreated"),
                escrow_id,
            ),
            (depositor, recipient, token_address, total_amount, deadline),
        );

        Ok(())
    }

    pub fn deposit_funds(env: Env, escrow_id: u64) -> Result<(), Error> {
        let storage_key = get_storage_key(escrow_id);
        ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;
        escrow.depositor.require_auth();

        if escrow.status != EscrowStatus::Created {
            return Err(Error::EscrowAlreadyFunded);
        }

        let token_client = token::Client::new(&env, &escrow.token_address);
        token_client.transfer_from(
            &env.current_contract_address(),
            &escrow.depositor,
            &env.current_contract_address(),
            &escrow.total_amount,
        );

        escrow.status = EscrowStatus::Active;
        env.storage().persistent().set(&storage_key, &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

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

    pub fn get_escrow(env: Env, escrow_id: u64) -> Result<Escrow, Error> {
        let storage_key = get_storage_key(escrow_id);
        env.storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)
    }

    pub fn get_state(env: Env, escrow_id: u64) -> Result<EscrowStatus, Error> {
        let escrow = Self::get_escrow(env, escrow_id)?;
        Ok(escrow.status)
    }

    pub fn release_milestone(env: Env, escrow_id: u64, milestone_index: u32) -> Result<(), Error> {
        let storage_key = get_storage_key(escrow_id);
        ensure_not_paused(&env)?;

        let mut escrow: Escrow = env
            .storage()
            .persistent()
            .get(&storage_key)
            .ok_or(Error::EscrowNotFound)?;
        escrow.depositor.require_auth();

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

        let (treasury, fee_bps) = Self::get_config(env.clone())?;
        let fee = calculate_fee(milestone.amount, fee_bps)?;
        let payout = milestone
            .amount
            .checked_sub(fee)
            .ok_or(Error::InvalidMilestoneAmount)?;

        let token_client = token::Client::new(&env, &escrow.token_address);
        token_client.transfer(&env.current_contract_address(), &escrow.recipient, &payout);

        if fee > 0 {
            token_client.transfer(&env.current_contract_address(), &treasury, &fee);
        }

        milestone.status = MilestoneStatus::Released;
        escrow.milestones.set(milestone_index, milestone.clone());

        escrow.total_released = escrow
            .total_released
            .checked_add(milestone.amount)
            .ok_or(Error::InvalidMilestoneAmount)?;

        env.storage().persistent().set(&storage_key, &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

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

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "DisputeResolved"),
                escrow_id,
            ),
            winner,
        );

        Ok(())
    }

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

        if escrow.status == EscrowStatus::Active {
            let token_client = token::Client::new(&env, &escrow.token_address);
            token_client.transfer(
                &env.current_contract_address(),
                &escrow.depositor,
                &escrow.total_amount,
            );
        }

        escrow.status = EscrowStatus::Cancelled;
        env.storage().persistent().set(&storage_key, &escrow);
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

        // Standardized Event
        env.events().publish(
            (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "EscrowCancelled"),
                escrow_id,
            ),
            escrow.depositor.clone(), // cancelled_by
        );

        Ok(())
    }

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
        env.storage()
            .persistent()
            .extend_ttl(&storage_key, 100, 2_000_000);

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

fn calculate_fee(amount: i128, fee_bps: i128) -> Result<i128, Error> {
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
