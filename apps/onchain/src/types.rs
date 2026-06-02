use soroban_sdk::{contracttype, Address, Env};

/// Represents the current state of an escrow transaction
#[derive(Clone, PartialEq, Debug)]
#[contracttype]
pub enum EscrowStatus {
    /// Escrow has been created but not yet funded
    Created,
    /// Funds have been deposited into the escrow
    Funded,
    /// Transaction completed successfully, funds released
    Completed,
    /// Dispute raised, awaiting resolution
    Disputed,
}

/// Core escrow data structure holding all transaction details
/// 
/// This struct represents a single escrow instance containing:
/// - Participant addresses (buyer and seller)
/// - Asset information (token address and amount)
/// - Current status and deadline for completion
#[derive(Clone)]
#[contracttype]
pub struct Escrow {
    /// Address of the buyer depositing funds
    pub buyer: Address,
    
    /// Address of the seller receiving funds upon completion
    pub seller: Address,
    
    /// Amount of tokens being held in escrow
    pub amount: i128,
    
    /// Address of the token contract (e.g., XLM or custom token)
    pub token_address: Address,
    
    /// Current state of the escrow transaction
    pub status: EscrowStatus,
    
    /// Unix timestamp deadline for escrow completion
    /// After this time, funds may be refundable
    pub deadline: u64,
}

impl Escrow {
    /// Creates a new Escrow instance
    ///
    /// # Arguments
    /// * `buyer` - Address depositing the funds
    /// * `seller` - Address receiving the funds
    /// * `token_address` - Contract address of the token being escrowed
    /// * `amount` - Quantity of tokens to hold
    /// * `deadline` - Unix timestamp when escrow expires
    ///
    /// # Returns
    /// New Escrow instance with status set to Created
    pub fn new(
        buyer: Address,
        seller: Address,
        token_address: Address,
        amount: i128,
        deadline: u64,
    ) -> Self {
        Self {
            buyer,
            seller,
            amount,
            token_address,
            status: EscrowStatus::Created,
            deadline,
        }
    }
}

/// Storage keys for persistent contract data
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    /// Counter for generating unique escrow IDs
    EscrowCounter,
    /// Individual escrow instance, keyed by ID
    Escrow(u64),
}