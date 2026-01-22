use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum EscrowError {
    EscrowNotFound = 1,
    UnauthorizedAccess = 2,
    InvalidStateTransition = 3,
    InsufficientFunds = 4,
    EscrowExpired = 5,
    EscrowNotExpired = 6,
    DuplicateParty = 7,
    InvalidAmount = 8,
    ConditionsNotMet = 9,
}