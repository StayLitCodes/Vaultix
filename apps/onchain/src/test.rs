use super::*;
use soroban_sdk::{Address, Env, testutils::Address as _, token, vec};

/// Helper function to create and initialize a test token
/// Returns admin client for minting and the token address
fn create_test_token<'a>(env: &Env, admin: &Address) -> (token::StellarAssetClient<'a>, Address) {
    let token_contract = env.register_stellar_asset_contract_v2(admin.clone());
    let token_address = token_contract.address(); // Get the address from the contract
    let token_admin_client = token::StellarAssetClient::new(env, &token_address);
    (token_admin_client, token_address)
}

#[test]
fn test_create_and_get_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 1u64;

    // Setup token
    let (_, token_address) = create_test_token(&env, &admin);

    // Create milestones
    let milestones = vec![
        &env,
        Milestone {
            amount: 3000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Design"),
        },
        Milestone {
            amount: 3000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Dev"),
        },
        Milestone {
            amount: 4000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Deploy"),
        },
    ];

    let deadline = 1706400000u64;

    // Create escrow
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
    );

    // Retrieve escrow
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.token_address, token_address);
    assert_eq!(escrow.total_amount, 10000);
    assert_eq!(escrow.total_released, 0);
    assert_eq!(escrow.status, EscrowStatus::Created);
    assert_eq!(escrow.milestones.len(), 3);
    assert_eq!(escrow.deadline, deadline);
}

#[test]
fn test_deposit_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 2u64;

    // Setup token - get admin client for minting
    let (token_admin, token_address) = create_test_token(&env, &admin);
    // Create regular client for other operations
    let token_client = token::Client::new(&env, &token_address);

    let initial_balance: i128 = 20_000;
    token_admin.mint(&depositor, &initial_balance);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Phase1"),
        },
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Phase2"),
        },
    ];

    // Create escrow
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    // Approve contract to spend tokens
    token_client.approve(&depositor, &contract_id, &10_000, &200);

    // Deposit funds
    client.deposit_funds(&escrow_id);

    // Verify escrow status changed to Active
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Active);

    // Verify tokens were transferred to contract
    assert_eq!(token_client.balance(&depositor), 10_000);
    assert_eq!(token_client.balance(&contract_id), 10_000);
}

#[test]
fn test_release_milestone_with_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 3u64;

    // Setup token
    let (token_admin, token_address) = create_test_token(&env, &admin);
    let token_client = token::Client::new(&env, &token_address);

    token_admin.mint(&depositor, &10_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 6000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Phase1"),
        },
        Milestone {
            amount: 4000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Phase2"),
        },
    ];

    // Create and fund escrow
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Initial balances
    assert_eq!(token_client.balance(&contract_id), 10_000);
    assert_eq!(token_client.balance(&recipient), 0);

    // Buyer confirms delivery and releases first milestone
    client.confirm_delivery(&escrow_id, &0, &depositor);

    // Verify tokens transferred to recipient
    assert_eq!(token_client.balance(&contract_id), 4000);
    assert_eq!(token_client.balance(&recipient), 6000);

    // Verify escrow state
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.total_released, 6000);
    assert_eq!(
        escrow.milestones.get(0).unwrap().status,
        MilestoneStatus::Released
    );
    assert_eq!(
        escrow.milestones.get(1).unwrap().status,
        MilestoneStatus::Pending
    );
}

#[test]
fn test_complete_escrow_with_all_releases() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 4u64;

    // Setup token
    let (token_admin, token_address) = create_test_token(&env, &admin);
    let token_client = token::Client::new(&env, &token_address);

    token_admin.mint(&depositor, &10_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task1"),
        },
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task2"),
        },
    ];

    // Create and fund escrow
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Buyer confirms delivery for all milestones
    client.confirm_delivery(&escrow_id, &0, &depositor);
    client.confirm_delivery(&escrow_id, &1, &depositor);

    // Verify all funds transferred to recipient
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&recipient), 10_000);

    // Complete the escrow
    client.complete_escrow(&escrow_id);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Completed);
    assert_eq!(escrow.total_released, 10_000);
}

#[test]
fn test_cancel_escrow_with_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 5u64;

    // Setup token
    let (token_admin, token_address) = create_test_token(&env, &admin);
    let token_client = token::Client::new(&env, &token_address);

    token_admin.mint(&depositor, &10_000);

    // Create token contract and mint tokens

    let milestones = vec![
        &env,
        Milestone {
            amount: 10000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    // Create and fund escrow
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Verify funds in contract
    assert_eq!(token_client.balance(&contract_id), 10_000);
    assert_eq!(token_client.balance(&depositor), 0);

    // Cancel escrow before any releases
    client.cancel_escrow(&escrow_id);

    // Verify funds returned to depositor
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&depositor), 10_000);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Cancelled);
}

#[test]
fn test_cancel_unfunded_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 6u64;

    let (_, token_address) = create_test_token(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    // Create escrow but don't fund it
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    // Cancel unfunded escrow (no refund needed)
    client.cancel_escrow(&escrow_id);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Cancelled);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_duplicate_escrow_id() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 7u64;

    let (_, token_address) = create_test_token(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 1000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Test"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );
    // This should panic with Error #2 (EscrowAlreadyExists)
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );
}

#[test]
fn test_double_release() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    // Initialize treasury
    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 8u64;

    let (token_admin, token_address) = create_test_token(&env, &admin);
    let token_client = token::Client::new(&env, &token_address);

    token_admin.mint(&depositor, &2000); // Increased to cover fees

    let milestones = vec![
        &env,
        Milestone {
            amount: 1000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );
    token_client.approve(&depositor, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);

    // First release should succeed
    client.release_milestone(&escrow_id, &0, &token_address);

    // Second release should fail with MilestoneAlreadyReleased
    let result = client.try_release_milestone(&escrow_id, &0, &token_address);
    assert_eq!(result, Err(Ok(Error::MilestoneAlreadyReleased)));
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_too_many_milestones() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 9u64;

    let (_, token_address) = create_test_token(&env, &admin);

    // Create 21 milestones (exceeds max of 20)
    let mut milestones = Vec::new(&env);
    for _i in 0..21 {
        milestones.push_back(Milestone {
            amount: 100,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        });
    }

    // This should panic with Error #10 (VectorTooLarge)
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #11)")]
fn test_invalid_milestone_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 10u64;

    let (_, token_address) = create_test_token(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 0, // Invalid: zero amount
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    // This should panic with Error #11 (ZeroAmount)
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );
}

#[test]
fn test_zero_amount_milestone_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 11u64;

    let (_, token_address) = create_test_token(&env, &admin);

    // Create milestones with one zero amount
    let milestones = vec![
        &env,
        Milestone {
            amount: 0,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Test"),
        },
    ];

    // Attempt to create escrow with zero amount milestone
    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    // Assert specific error is returned
    assert_eq!(result, Err(Ok(Error::ZeroAmount)));
}

#[test]
fn test_negative_amount_milestone_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 12u64;

    let (_, token_address) = create_test_token(&env, &admin);

    // Create milestones with negative amount
    let milestones = vec![
        &env,
        Milestone {
            amount: -1000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Test"),
        },
    ];

    // Attempt to create escrow
    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    // Assert ZeroAmount error (covers negative case)
    assert_eq!(result, Err(Ok(Error::ZeroAmount)));
}

#[test]
fn test_self_dealing_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let same_party = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 13u64;

    let (_, token_address) = create_test_token(&env, &admin);

    // Create valid milestones
    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    // Attempt to create escrow where depositor == recipient
    let result = client.try_create_escrow(
        &escrow_id,
        &same_party,
        &same_party,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    // Assert SelfDealing error
    assert_eq!(result, Err(Ok(Error::SelfDealing)));
}

#[test]
fn test_valid_escrow_creation_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 14u64;

    let (_, token_address) = create_test_token(&env, &admin);

    // Valid milestones with positive amounts
    let milestones = vec![
        &env,
        Milestone {
            amount: 3000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Phase1"),
        },
        Milestone {
            amount: 7000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Phase2"),
        },
    ];

    // Create escrow - should succeed
    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    // Assert success
    assert!(result.is_ok());

    // Verify escrow was created correctly
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.total_amount, 10000);
    assert_eq!(escrow.token_address, token_address);
}

#[test]
#[should_panic(expected = "Error(Contract, #14)")]
fn test_double_deposit_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 15u64;

    let (token_admin, token_address) = create_test_token(&env, &admin);
    let token_client = token::Client::new(&env, &token_address);

    token_admin.mint(&depositor, &20_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // This should panic with Error #14 (EscrowAlreadyFunded)
    client.deposit_funds(&escrow_id);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_release_milestone_before_deposit() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 16u64;

    let (_, token_address) = create_test_token(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    // Try to release milestone before depositing funds
    // This should panic with Error #9 (EscrowNotActive)
    client.release_milestone(&escrow_id, &0, &token_address);
}
