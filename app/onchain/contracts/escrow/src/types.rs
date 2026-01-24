use soroban_sdk::{contracttype, Address, BytesN};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum EscrowState {
    Pending,
    Active,
    Completed,
    Disputed,
    Cancelled,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Party {
    pub address: Address,
    pub has_confirmed: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowAgreement {
    pub id: BytesN<32>,
    pub parties: soroban_sdk::Vec<Party>,
    pub amount: i128,
    pub conditions_hash: BytesN<32>,
    pub state: EscrowState,
    pub created_at: u64,
    pub expires_at: Option<u64>,
    pub total_deposited: i128,
    pub deposits: soroban_sdk::Map<Address, i128>,
}