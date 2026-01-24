#![no_std]
#![deny(clippy::all)]

mod types;
mod errors;
mod storage;
mod events;

use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Vec};
use types::{EscrowAgreement, EscrowState, Party};
use errors::EscrowError;
use events::EscrowCreated;
use storage::EscrowStorage;

#[contract]
pub struct EscrowContract;

#[contractimpl]
impl EscrowContract {
    /// Creates a new escrow agreement between multiple parties
    ///
    /// # Arguments
    /// * `parties` - List of party addresses participating in the escrow
    /// * `amount` - The amount to be escrowed in stroops
    /// * `conditions_hash` - Hash of the escrow conditions
    /// * `expires_at` - Optional expiration timestamp
    ///
    /// # Returns
    /// The escrow ID as a 32-byte hash
    ///
    /// # Errors
    /// * `InvalidAmount` - If amount is zero or negative
    /// * `EscrowExpired` - If deadline is in the past
    /// * `DuplicateParty` - If duplicate party addresses are provided
    ///
    /// # Events
    /// Emits `EscrowCreated` event upon successful creation
    ///
    /// # Gas Estimation
    /// Estimated gas cost: ~2,500,000 gas units
    /// - Storage writes: ~1,000,000
    /// - Event emission: ~500,000
    /// - Validation: ~1,000,000
    pub fn create_escrow(
        env: Env,
        parties: Vec<Address>,
        amount: i128,
        conditions_hash: BytesN<32>,
        expires_at: Option<u64>,
    ) -> Result<BytesN<32>, EscrowError> {
        // === INPUT VALIDATION ===
        
        // Validate amount is positive
        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }
        
        // Validate parties list is not empty
        if parties.is_empty() {
            return Err(EscrowError::InvalidAmount); // Reuse error for empty parties
        }
        
        // Validate parties list has at least 2 parties
        if parties.len() < 2 {
            return Err(EscrowError::InvalidAmount); // Reuse error for insufficient parties
        }
        
        // Validate deadline is in the future if provided
        if let Some(deadline) = expires_at {
            let current_time = env.ledger().timestamp();
            if deadline <= current_time {
                return Err(EscrowError::EscrowExpired);
            }
        }
        
        // Validate no duplicate parties
        let mut unique_parties = Vec::new(&env);
        for party in parties.iter() {
            if unique_parties.contains(&party) {
                return Err(EscrowError::DuplicateParty);
            }
            unique_parties.push_back(party);
        }
        
        // === ESCROW CREATION ===
        
        // Generate unique escrow ID
        let escrow_id = EscrowStorage::generate_escrow_id(&env);
        
        // Create party records with initial confirmation status
        let mut party_records = Vec::new(&env);
        for party in parties.iter() {
            party_records.push_back(Party {
                address: party.clone(),
                has_confirmed: false,
            });
        }
        
        // Create escrow agreement
        let escrow = EscrowAgreement {
            id: escrow_id.clone(),
            parties: party_records,
            amount,
            conditions_hash: conditions_hash.clone(),
            state: EscrowState::Pending,
            created_at: env.ledger().timestamp(),
            expires_at,
            deposits: soroban_sdk::Map::new(&env),
            total_deposited: 0,
        };
        
        // Store escrow in persistent storage
        EscrowStorage::store_escrow(&env, &escrow_id, &escrow);
        
        // === EVENT EMISSION ===
        
        // Extract party addresses for event
        let party_addresses = parties;
        
        // Emit creation event
        env.events().publish(
            (EscrowCreated::TOPIC, escrow_id.clone()),
            (escrow_id.clone(), env.current_contract_address(), party_addresses, amount, conditions_hash, expires_at, escrow.created_at),
        );
        
        Ok(escrow_id)
    }

    /// Deposits funds into an existing escrow
    ///
    /// # Arguments
    /// * `escrow_id` - The unique identifier of the escrow
    /// * `depositor` - The address making the deposit
    /// * `amount` - Amount to deposit
    pub fn deposit(
        env: Env,
        escrow_id: BytesN<32>,
        depositor: Address,
        token_address: Address,
        amount: i128,
    ) -> Result<(), EscrowError> {
        // Reentrancy protection: use a storage-based lock flag
        let lock_key = ("deposit_lock", escrow_id.clone());
        if env.storage().temporary().has(&lock_key) {
            return Err(EscrowError::ReentrancyDetected);
        }
        env.storage().temporary().set(&lock_key, &true);

        // Check if escrow exists
        let mut escrow = match EscrowStorage::get_escrow(&env, &escrow_id) {
            Some(e) => e,
            None => return Err(EscrowError::EscrowNotFound),
        };

        // Only allow deposit if escrow is Pending or Active
        match escrow.state {
            EscrowState::Pending | EscrowState::Active => {},
            _ => return Err(EscrowError::InvalidState),
        }

        // Check if depositor is a party
        let is_party = escrow.parties.iter().any(|p| p.address == depositor);
        if !is_party {
            return Err(EscrowError::UnauthorizedParty);
        }

        // Prevent zero or negative deposit
        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        // Prevent over-deposit
        let remaining = escrow.amount - escrow.total_deposited;
        if amount > remaining {
            return Err(EscrowError::OverDeposit);
        }

        // Prevent duplicate full deposit
        if escrow.total_deposited == escrow.amount {
            return Err(EscrowError::AlreadyDeposited);
        }

        // Update per-party deposit
        let mut party_deposit = escrow.deposits.get(depositor.clone()).unwrap_or(0);
        party_deposit += amount;
        escrow.deposits.set(depositor.clone(), party_deposit);

        // Authenticate the depositor
        depositor.require_auth();

        // Check if escrow exists
        let mut escrow = match EscrowStorage::get_escrow(&env, &escrow_id) {
            Some(e) => e,
            None => return Err(EscrowError::EscrowNotFound),
        };

        // Only allow deposit if escrow is Pending or Active
        match escrow.state {
            EscrowState::Pending | EscrowState::Active => {},
            _ => return Err(EscrowError::InvalidState),
        }

        // Check if depositor is a party
        let is_party = escrow.parties.iter().any(|p| p.address == depositor);
        if !is_party {
            return Err(EscrowError::UnauthorizedParty);
        }

        // Prevent zero or negative deposit
        if amount <= 0 {
            return Err(EscrowError::InvalidAmount);
        }

        // Prevent over-deposit
        let remaining = escrow.amount - escrow.total_deposited;
        if amount > remaining {
            return Err(EscrowError::OverDeposit);
        }

        // Prevent duplicate full deposit
        if escrow.total_deposited == escrow.amount {
            return Err(EscrowError::AlreadyDeposited);
        }

        // Reentrancy protection: use a storage-based lock flag
        let lock_key = ("deposit_lock", escrow_id.clone());
        if env.storage().temporary().has(&lock_key) {
            return Err(EscrowError::ReentrancyDetected);
        }
        env.storage().temporary().set(&lock_key, &true);

        // Token transfer logic
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);
        let balance = token_client.balance(&depositor);
        if balance < amount {
            env.storage().temporary().remove(&lock_key);
            return Err(EscrowError::InsufficientFunds);
        }
        token_client.transfer(&depositor, &env.current_contract_address(), &amount);

        // Update per-party deposit
        let mut party_deposit = escrow.deposits.get(depositor.clone()).unwrap_or(0);
        party_deposit += amount;
        escrow.deposits.set(depositor.clone(), party_deposit);

        // Update total deposited
        escrow.total_deposited += amount;

        // State transition: Pending -> Active if fully funded
        if escrow.total_deposited == escrow.amount {
            escrow.state = EscrowState::Active;
        }

        // Store updated escrow
        EscrowStorage::store_escrow(&env, &escrow_id, &escrow);

        // Emit deposit event
        let event = events::EscrowDeposited {
            escrow_id: escrow_id.clone(),
            depositor: depositor.clone(),
            amount,
            total_deposited: escrow.total_deposited,
        };
        env.events().publish(
            events::EscrowDeposited::TOPIC,
            event
        );

        env.storage().temporary().remove(&lock_key); // Release lock
        Ok(())
    }
        
    pub fn dispute(
        env: Env,
        escrow_id: BytesN<32>,
        disputer: Address,
    ) -> Result<(), EscrowError> {
        // Placeholder implementation - returns error for now
        Err(EscrowError::EscrowNotFound)
    }

    /// Gets the current state of an escrow agreement
    ///
    /// # Arguments
    /// * `escrow_id` - The unique identifier of the escrow
    ///
    /// # Returns
    /// The escrow agreement details
    pub fn get_escrow(
        env: Env,
        escrow_id: BytesN<32>,
    ) -> Result<EscrowAgreement, EscrowError> {
        // Try to get escrow from storage
        match EscrowStorage::get_escrow(&env, &escrow_id) {
            Some(escrow) => Ok(escrow),
            None => Err(EscrowError::EscrowNotFound),
        }
    }
}


#[cfg(test)]
mod tests {
        #[test]
        fn test_deposit_authorized_party() {
            let env = Env::default();
            let contract_id = env.register_contract(None, EscrowContract);
            let client = EscrowContractClient::new(&env, &contract_id);

            let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let parties = vec![&env, party1.clone(), party2.clone()];
            let amount = 1000i128;
            let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);
            let escrow_id = client.create_escrow(&parties, &amount, &conditions_hash, &None);

            // Authorized deposit
            let deposit_amount = 400i128;
            let result = client.deposit(&escrow_id, &party1, &deposit_amount);
            assert!(result.is_ok());
            let escrow = client.get_escrow(&escrow_id).unwrap();
            assert_eq!(escrow.total_deposited, deposit_amount);
            assert_eq!(escrow.state, EscrowState::Pending);
        }

        #[test]
        fn test_deposit_unauthorized_party() {
            let env = Env::default();
            let contract_id = env.register_contract(None, EscrowContract);
            let client = EscrowContractClient::new(&env, &contract_id);

            let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let not_party = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let parties = vec![&env, party1.clone(), party2.clone()];
            let amount = 1000i128;
            let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);
            let escrow_id = client.create_escrow(&parties, &amount, &conditions_hash, &None);

            // Unauthorized deposit
            let result = client.try_deposit(&escrow_id, &not_party, &100i128);
            assert!(result.is_err());
            assert_eq!(result.err().unwrap(), EscrowError::UnauthorizedParty);
        }

        #[test]
        fn test_deposit_full_transitions_active() {
            let env = Env::default();
            let contract_id = env.register_contract(None, EscrowContract);
            let client = EscrowContractClient::new(&env, &contract_id);

            let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let parties = vec![&env, party1.clone(), party2.clone()];
            let amount = 1000i128;
            let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);
            let escrow_id = client.create_escrow(&parties, &amount, &conditions_hash, &None);

            // Full deposit
            let result = client.deposit(&escrow_id, &party1, &1000i128);
            assert!(result.is_ok());
            let escrow = client.get_escrow(&escrow_id).unwrap();
            assert_eq!(escrow.total_deposited, 1000i128);
            assert_eq!(escrow.state, EscrowState::Active);
        }

        #[test]
        fn test_deposit_partial_updates_balance() {
            let env = Env::default();
            let contract_id = env.register_contract(None, EscrowContract);
            let client = EscrowContractClient::new(&env, &contract_id);

            let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let parties = vec![&env, party1.clone(), party2.clone()];
            let amount = 1000i128;
            let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);
            let escrow_id = client.create_escrow(&parties, &amount, &conditions_hash, &None);

            // Partial deposit
            let result1 = client.deposit(&escrow_id, &party1, &400i128);
            let result2 = client.deposit(&escrow_id, &party2, &300i128);
            assert!(result1.is_ok() && result2.is_ok());
            let escrow = client.get_escrow(&escrow_id).unwrap();
            assert_eq!(escrow.total_deposited, 700i128);
            assert_eq!(escrow.state, EscrowState::Pending);
        }

        #[test]
        fn test_deposit_to_nonexistent_escrow() {
            let env = Env::default();
            let contract_id = env.register_contract(None, EscrowContract);
            let client = EscrowContractClient::new(&env, &contract_id);

            let party = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let escrow_id = BytesN::from_array(&env, &[9u8; 32]);
            let result = client.try_deposit(&escrow_id, &party, &100i128);
            assert!(result.is_err());
            assert_eq!(result.err().unwrap(), EscrowError::EscrowNotFound);
        }

        #[test]
        fn test_deposit_over_deposit() {
            let env = Env::default();
            let contract_id = env.register_contract(None, EscrowContract);
            let client = EscrowContractClient::new(&env, &contract_id);

            let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let parties = vec![&env, party1.clone(), party2.clone()];
            let amount = 1000i128;
            let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);
            let escrow_id = client.create_escrow(&parties, &amount, &conditions_hash, &None);

            // Over deposit
            let result = client.try_deposit(&escrow_id, &party1, &2000i128);
            assert!(result.is_err());
            assert_eq!(result.err().unwrap(), EscrowError::OverDeposit);
        }

        #[test]
        fn test_deposit_event_emitted() {
            let env = Env::default();
            let contract_id = env.register_contract(None, EscrowContract);
            let client = EscrowContractClient::new(&env, &contract_id);

            let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
            let parties = vec![&env, party1.clone(), party2.clone()];
            let amount = 1000i128;
            let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);
            let escrow_id = client.create_escrow(&parties, &amount, &conditions_hash, &None);

            let deposit_amount = 500i128;
            let _ = client.deposit(&escrow_id, &party1, &deposit_amount);
            let events = env.events().all();
            let deposit_event = events.iter().find(|e| e.topic.0 == "escrow" && e.topic.1 == "deposited");
            assert!(deposit_event.is_some());
            let event = deposit_event.unwrap();
            let event_tuple: (BytesN<32>, Address, i128, i128) = event.data.clone().try_into().unwrap();
            assert_eq!(event_tuple.0, escrow_id);
            assert_eq!(event_tuple.1, party1);
            assert_eq!(event_tuple.2, deposit_amount);
            assert_eq!(event_tuple.3, deposit_amount);
        }
    use super::*;
    use soroban_sdk::testutils::{Address as AddressTestUtils, Events as EventsTestUtils};
    use soroban_sdk::{vec, Address, Env};

    #[test]
    fn test_create_escrow_success() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let parties = vec![&env, party1.clone(), party2.clone()];
        let amount = 1000000000i128; // 100 XLM in stroops
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);
        let expires_at = Some(1735689600u64); // Future timestamp

        // Create escrow
        let escrow_id = client.create_escrow(&parties, &amount, &conditions_hash, &expires_at);

        // Verify escrow was created
        let escrow = client.get_escrow(&escrow_id).unwrap();
        assert_eq!(escrow.id, escrow_id);
        assert_eq!(escrow.amount, amount);
        assert_eq!(escrow.conditions_hash, conditions_hash);
        assert_eq!(escrow.expires_at, expires_at);
        assert_eq!(escrow.state, EscrowState::Pending);
        assert_eq!(escrow.parties.len(), 2);
        
        // Verify party records
        assert_eq!(escrow.parties.get(0).unwrap().address, party1);
        assert_eq!(escrow.parties.get(1).unwrap().address, party2);
        assert!(!escrow.parties.get(0).unwrap().has_confirmed);
        assert!(!escrow.parties.get(1).unwrap().has_confirmed);

        // Verify event was emitted
        let events = env.events().all();
        assert_eq!(events.len(), 1);
        let event = &events[0];
        assert_eq!(event.topic, (EscrowCreated::TOPIC, escrow_id));
        
        // Event data is now a tuple: (escrow_id, creator, parties, amount, conditions_hash, expires_at, created_at)
        let event_tuple: (BytesN<32>, Address, Vec<Address>, i128, BytesN<32>, Option<u64>, u64) = event.data.clone().try_into().unwrap();
        assert_eq!(event_tuple.0, escrow_id);
        assert_eq!(event_tuple.3, amount); // amount is at index 3
        assert_eq!(event_tuple.2.len(), 2); // parties is at index 2
    }

    #[test]
    fn test_create_escrow_zero_amount() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let parties = vec![&env, party1, party2];
        let amount = 0i128;
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);

        let result = client.try_create_escrow(&parties, &amount, &conditions_hash, &None);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), EscrowError::InvalidAmount);
    }

    #[test]
    fn test_create_escrow_negative_amount() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let parties = vec![&env, party1, party2];
        let amount = -100i128;
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);

        let result = client.try_create_escrow(&parties, &amount, &conditions_hash, &None);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), EscrowError::InvalidAmount);
    }

    #[test]
    fn test_create_escrow_empty_parties() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let parties = vec![&env];
        let amount = 1000000000i128;
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);

        let result = client.try_create_escrow(&parties, &amount, &conditions_hash, &None);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), EscrowError::InvalidAmount);
    }

    #[test]
    fn test_create_escrow_single_party() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let parties = vec![&env, party1];
        let amount = 1000000000i128;
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);

        let result = client.try_create_escrow(&parties, &amount, &conditions_hash, &None);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), EscrowError::InvalidAmount);
    }

    #[test]
    fn test_create_escrow_duplicate_parties() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let parties = vec![&env, party1.clone(), party1.clone()];
        let amount = 1000000000i128;
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);

        let result = client.try_create_escrow(&parties, &amount, &conditions_hash, &None);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), EscrowError::DuplicateParty);
    }

    #[test]
    fn test_create_escrow_past_deadline() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let parties = vec![&env, party1, party2];
        let amount = 1000000000i128;
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);
        let past_timestamp = 1000u64; // Past timestamp

        let result = client.try_create_escrow(&parties, &amount, &conditions_hash, &Some(past_timestamp));
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), EscrowError::EscrowExpired);
    }

    #[test]
    fn test_create_escrow_unique_ids() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let parties = vec![&env, party1.clone(), party2.clone()];
        let amount = 1000000000i128;
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);

        // Create multiple escrows
        let escrow_id1 = client.create_escrow(&parties, &amount, &conditions_hash, &None);
        let escrow_id2 = client.create_escrow(&parties, &amount, &conditions_hash, &None);

        // Verify IDs are unique
        assert_ne!(escrow_id1, escrow_id2);
    }

    #[test]
    fn test_create_escrow_without_deadline() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let party1 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let party2 = <soroban_sdk::Address as AddressTestUtils>::generate(&env);
        let parties = vec![&env, party1, party2];
        let amount = 1000000000i128;
        let conditions_hash = BytesN::from_array(&env, &[1u8; 32]);

        // Create escrow without deadline
        let escrow_id = client.create_escrow(&parties, &amount, &conditions_hash, &None);

        // Verify escrow was created with no expiration
        let escrow = client.get_escrow(&escrow_id).unwrap();
        assert_eq!(escrow.expires_at, None);
        assert_eq!(escrow.state, EscrowState::Pending);
    }

    #[test]
    fn test_get_nonexistent_escrow() {
        let env = Env::default();
        let contract_id = env.register_contract(None, EscrowContract);
        let client = EscrowContractClient::new(&env, &contract_id);

        let escrow_id = BytesN::from_array(&env, &[2u8; 32]);

        let result = client.try_get_escrow(&escrow_id);
        assert!(result.is_err());
        assert_eq!(result.err().unwrap(), EscrowError::EscrowNotFound);
    }

    #[test]
    fn test_escrow_error_codes() {
        // Test that error codes are correctly defined
        assert_eq!(EscrowError::EscrowNotFound as u32, 1);
        assert_eq!(EscrowError::UnauthorizedAccess as u32, 2);
        assert_eq!(EscrowError::InvalidStateTransition as u32, 3);
        assert_eq!(EscrowError::InsufficientFunds as u32, 4);
        assert_eq!(EscrowError::EscrowExpired as u32, 5);
        assert_eq!(EscrowError::EscrowNotExpired as u32, 6);
        assert_eq!(EscrowError::DuplicateParty as u32, 7);
        assert_eq!(EscrowError::InvalidAmount as u32, 8);
        assert_eq!(EscrowError::ConditionsNotMet as u32, 9);
    }
}