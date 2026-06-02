use super::*;
use soroban_sdk::{testutils::Address as _, testutils::Events, Env, Address, Vec, Symbol};

#[test]
fn test_admin_upgrade_and_state_preservation() {
    let env = Env::default();
    env.mock_all_auths();

    // Deploy version A
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    // Set admin
    let admin = Address::generate(&env);
    client.init(&admin);

    // Create escrow
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_address = Address::generate(&env);
    let milestones = Vec::new(&env);
    milestones.push_back(Milestone {
        amount: 1000,
        status: MilestoneStatus::Pending,
        description: Symbol::new(&env, "Test"),
    });
    let deadline = 1706400000u64;
    client.create_escrow(&1u64, &depositor, &recipient, &token_address, &milestones, &deadline);

    // Simulate upgrade: deploy version B (same contract, but would add a helper in real scenario)
    let new_wasm_hash = vec![&env, 1u8, 2u8, 3u8]; // Dummy hash for test
    let result = client.try_upgrade(&new_wasm_hash);
    assert!(result.is_ok());

    // State should be preserved
    let escrow = client.get_escrow(&1u64);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.total_amount, 1000);

    // Event should be emitted
    let events = env.events().all();
    let found = events.iter().any(|e| {
        let topics: Vec<_> = e.1.into_val(&env);
        topics.contains(&Symbol::new(&env, "ContractUpgraded").into_val(&env))
    });
    assert!(found);
}

#[test]
fn test_upgrade_rejects_non_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    // Set admin
    let admin = Address::generate(&env);
    client.init(&admin);

    // Try upgrade as non-admin
    let new_wasm_hash = vec![&env, 1u8, 2u8, 3u8];
    let not_admin = Address::generate(&env);
    env.set_source_account(&not_admin);
    let result = client.try_upgrade(&new_wasm_hash);
    assert_eq!(result, Err(Ok(Error::UnauthorizedAccess)));
}
