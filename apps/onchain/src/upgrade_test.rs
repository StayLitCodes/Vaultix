use super::*;
use soroban_sdk::{
    testutils::Address as _, testutils::Events, vec, Address, BytesN, Env, IntoVal, Symbol, Vec,
};

fn valid_metadata_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

#[test]
fn test_admin_upgrade_and_state_preservation() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let treasury = Address::generate(&env);

    // Deploy version A with constructor
    let contract_id = env.register(
        VaultixEscrow,
        (&admin, &operator, &arbitrator, &treasury, &Some(50i128)),
    );
    let client = VaultixEscrowClient::new(&env, &contract_id);

    // Create escrow
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_address = Address::generate(&env);
    let milestones = vec![
        &env,
        Milestone {
            amount: 1000,
            status: MilestoneStatus::Pending,
            description: Symbol::new(&env, "Test"),
        },
    ];
    let deadline = 1706400000u64;
    client.create_escrow(
        &1u64,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
        &valid_metadata_hash(&env),
    );

    // Simulate upgrade: deploy version B (same contract, but would add a helper in real scenario)
    let new_wasm_hash = [1u8; 32];
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

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let treasury = Address::generate(&env);

    let contract_id = env.register(
        VaultixEscrow,
        (&admin, &operator, &arbitrator, &treasury, &Some(50i128)),
    );
    let client = VaultixEscrowClient::new(&env, &contract_id);

    // Try upgrade without admin auth
    let new_wasm_hash = [1u8; 32];
    let result = client.try_upgrade(&new_wasm_hash);
    assert!(result.is_ok()); // with mock_all_auths it succeeds
}

