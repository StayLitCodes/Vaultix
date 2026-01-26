#![no_std]
use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, Address, Env,
};

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[contracttype]
pub enum EscrowStatus {
    Created = 0,
    Released = 1,
    Disputed = 2,
    Resolved = 3,
}

#[derive(Clone, Debug)]
#[contracttype]
pub struct Escrow {
    pub id: u64,
    pub buyer: Address,
    pub seller: Address,
    pub amount: i128,
    pub status: EscrowStatus,
}

#[contract]
pub struct VaultixContract;

#[contractimpl]
impl VaultixContract {
    pub fn create_escrow(env: Env, id: u64, buyer: Address, seller: Address, amount: i128) {
        buyer.require_auth();

        let escrow = Escrow {
            id,
            buyer: buyer.clone(),
            seller: seller.clone(),
            amount,
            status: EscrowStatus::Created,
        };

        env.storage().persistent().set(&id, &escrow);

        env.events().publish(
            (symbol_short!("create"), id, buyer, seller),
            amount,
        );
    }

    pub fn confirm_delivery(env: Env, id: u64) {
        let mut escrow: Escrow = env.storage().persistent().get(&id).unwrap();
        escrow.buyer.require_auth();

        escrow.status = EscrowStatus::Released;
        env.storage().persistent().set(&id, &escrow);

        env.events().publish(
            (symbol_short!("release"), id),
            escrow.amount,
        );
    }

    pub fn raise_dispute(env: Env, id: u64, caller: Address) {
        caller.require_auth();
        let mut escrow: Escrow = env.storage().persistent().get(&id).unwrap();
        
        if caller != escrow.buyer && caller != escrow.seller {
            panic!("Only buyer or seller can raise a dispute");
        }

        escrow.status = EscrowStatus::Disputed;
        env.storage().persistent().set(&id, &escrow);

        env.events().publish(
            (symbol_short!("dispute"), id, caller),
            (),
        );
    }

    pub fn resolve_dispute(env: Env, id: u64, winner: Address) {
        // In a real scenario, this would require admin auth
        let mut escrow: Escrow = env.storage().persistent().get(&id).unwrap();
        
        escrow.status = EscrowStatus::Resolved;
        env.storage().persistent().set(&id, &escrow);

        env.events().publish(
            (symbol_short!("resolve"), id, winner),
            escrow.amount,
        );
    }

    pub fn get_escrow(env: Env, id: u64) -> Option<Escrow> {
        env.storage().persistent().get(&id)
    }
}

#[cfg(test)]
mod test;
