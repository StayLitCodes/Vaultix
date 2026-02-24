use super::*;
use soroban_sdk::{Address, Env, testutils::Address as _, token, vec};

fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (token::Client<'a>, token::StellarAssetClient<'a>) {
    let contract_address = env.register_stellar_asset_contract_v2(admin.clone());
    (
        token::Client::new(env, &contract_address.address()),
        token::StellarAssetClient::new(env, &contract_address.address()),
    )
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

    // Create token contract and mint tokens to depositor
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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

    // Create escrow
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &milestones,
        &token_client.address,
    );

    // Retrieve escrow
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.total_amount, 10000);
    assert_eq!(escrow.total_released, 0);
    assert_eq!(escrow.status, EscrowStatus::Active);
    assert_eq!(escrow.milestones.len(), 3);

    // Check balances after escrow creation
    assert_eq!(token_client.balance(&depositor), 0); // 10000 - 10000
    assert_eq!(token_client.balance(&contract_id), 10000);
    assert_eq!(token_client.balance(&recipient), 0);
}

#[test]
fn test_buyer_confirm_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 2u64;

    // Create token contract and mint tokens to buyer
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&buyer, &10000);

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

    client.create_escrow(
        &escrow_id,
        &buyer,
        &seller,
        &milestones,
        &token_client.address,
    );

    // Buyer confirms delivery and releases first milestone
    client.confirm_delivery(&escrow_id, &0, &buyer);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.total_released, 5000);
    assert_eq!(
        escrow.milestones.get(0).unwrap().status,
        MilestoneStatus::Released
    );
    assert_eq!(
        escrow.milestones.get(1).unwrap().status,
        MilestoneStatus::Pending
    );

    // Check seller received funds
    assert_eq!(token_client.balance(&buyer), 0);
    assert_eq!(token_client.balance(&contract_id), 5000);
    assert_eq!(token_client.balance(&seller), 5000);
}

#[test]
fn test_complete_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 3u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &milestones,
        &token_client.address,
    );

    // Release all milestones
    client.release_milestone(&escrow_id, &0);
    client.release_milestone(&escrow_id, &1);

    // Complete the escrow
    client.complete_escrow(&escrow_id);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Completed);
    assert_eq!(escrow.total_released, 10000);
}

#[test]
fn test_cancel_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 4u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 10000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &milestones,
        &token_client.address,
    );

    // Cancel before any releases
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
    let escrow_id = 5u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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
        &milestones,
        &token_client.address,
    );
    // This should panic with Error #2 (EscrowAlreadyExists)
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &milestones,
        &token_client.address,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_double_release() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 6u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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
        &milestones,
        &token_client.address,
    );
    client.release_milestone(&escrow_id, &0);
    // This should panic with Error #4 (MilestoneAlreadyReleased)
    client.release_milestone(&escrow_id, &0);
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
    let escrow_id = 7u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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
        &milestones,
        &token_client.address,
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
    let escrow_id = 8u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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
        &milestones,
        &token_client.address,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_unauthorized_confirm_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let non_buyer = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 9u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&buyer, &10000);

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
        &buyer,
        &seller,
        &milestones,
        &token_client.address,
    );

    // Non-buyer tries to confirm delivery - should panic with Error #5 (UnauthorizedAccess)
    client.confirm_delivery(&escrow_id, &0, &non_buyer);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_double_confirm_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 10u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&buyer, &10000);

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
        &buyer,
        &seller,
        &milestones,
        &token_client.address,
    );

    // First confirmation succeeds
    client.confirm_delivery(&escrow_id, &0, &buyer);

    // Second confirmation should panic with Error #4 (MilestoneAlreadyReleased)
    client.confirm_delivery(&escrow_id, &0, &buyer);
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

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    // Create milestones with one zero amount
    let milestones = vec![
        &env,
        Milestone {
            amount: 0, // Invalid: zero amount
            status: MilestoneStatus::Pending,
            description: symbol_short!("Test"),
        },
    ];

    // Attempt to create escrow with zero amount milestone
    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &milestones,
        &token_client.address,
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

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    // Create milestones with negative amount
    let milestones = vec![
        &env,
        Milestone {
            amount: -1000, // Invalid: negative amount
            status: MilestoneStatus::Pending,
            description: symbol_short!("Test"),
        },
    ];

    // Attempt to create escrow
    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &milestones,
        &token_client.address,
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

    let same_party = Address::generate(&env); // Same address for both
    let admin = Address::generate(&env);
    let escrow_id = 13u64;

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&same_party, &10000);

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
        &milestones,
        &token_client.address,
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

    // Create token contract and mint tokens
    let (token_client, token_admin) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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
        &milestones,
        &token_client.address,
    );

    // Assert success
    assert!(result.is_ok());

    // Verify escrow was created correctly
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.total_amount, 10000);
}
