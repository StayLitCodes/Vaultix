use soroban_sdk::{Address, BytesN, Vec, contracttype};

/// Event emitted when a new escrow is created
pub struct EscrowCreated {
    pub escrow_id: BytesN<32>,
    pub creator: Address,
    pub parties: Vec<Address>,
    pub amount: i128,
    pub conditions_hash: BytesN<32>,
    pub expires_at: Option<u64>,
    pub created_at: u64,
}

impl EscrowCreated {
    pub const TOPIC: (&'static str, &'static str) = ("escrow", "created");
}

/// Event emitted when funds are deposited into an escrow

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowDeposited {
    pub escrow_id: BytesN<32>,
    pub depositor: Address,
    pub amount: i128,
    pub total_deposited: i128,
}

impl EscrowDeposited {
    pub const TOPIC: (&'static str, &'static str) = ("escrow", "deposited");
}

/// Event emitted when a party confirms participation
pub struct EscrowConfirmed {
    pub escrow_id: BytesN<32>,
    pub party: Address,
    pub confirmed_at: u64,
}

impl EscrowConfirmed {
    pub const TOPIC: (&'static str, &'static str) = ("escrow", "confirmed");
}

/// Event emitted when funds are released from escrow
pub struct EscrowReleased {
    pub escrow_id: BytesN<32>,
    pub recipient: Address,
    pub amount: i128,
    pub released_at: u64,
}

impl EscrowReleased {
    pub const TOPIC: (&'static str, &'static str) = ("escrow", "released");
}

/// Event emitted when a dispute is initiated
pub struct EscrowDisputed {
    pub escrow_id: BytesN<32>,
    pub disputer: Address,
    pub disputed_at: u64,
}

impl EscrowDisputed {
    pub const TOPIC: (&'static str, &'static str) = ("escrow", "disputed");
}

/// Event emitted when an escrow is cancelled
pub struct EscrowCancelled {
    pub escrow_id: BytesN<32>,
    pub cancelled_by: Address,
    pub cancelled_at: u64,
}

impl EscrowCancelled {
    pub const TOPIC: (&'static str, &'static str) = ("escrow", "cancelled");
}
