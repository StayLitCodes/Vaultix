use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events},
    token, vec, Address, Env, IntoVal,
};

/// Helper function to create and initialize a test token
/// Returns admin client for minting and the token address
fn create_test_token<'a>(env: &Env, admin: &Address) -> (token::StellarAssetClient<'a>, Address) {
    let token_address = env.register_stellar_asset_contract(admin.clone());
    let token_admin_client = token::StellarAssetClient::new(env, &token_address);
    (token_admin_client, token_address)
}

/// Helper function to create token client + admin + address
fn create_token_contract<'a>(
    env: &Env,
    admin: &Address,
) -> (token::Client<'a>, token::StellarAssetClient<'a>, Address) {
    let (token_admin, token_address) = create_test_token(env, admin);
    let token_client = token::Client::new(env, &token_address);
    (token_client, token_admin, token_address)
}

#[test]
fn test_create_escrow_fails_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &None);
    client.set_paused(&true);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 1_000u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    let deadline = 1_706_400_000u64;

    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
    );

    assert_eq!(result, Err(Ok(Error::ContractPaused)));
}

#[test]
fn test_deposit_funds_fails_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &None);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 1_001u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    let deadline = 1_706_400_000u64;
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);

    client.set_paused(&true);
    let result = client.try_deposit_funds(&escrow_id);
    assert_eq!(result, Err(Ok(Error::ContractPaused)));
}

#[test]
fn test_create_and_get_escrow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 1u64;

    // Setup token
    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
    );

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.token_address, token_address);
    assert_eq!(escrow.total_amount, 10000);
    assert_eq!(escrow.total_released, 0);
    assert_eq!(escrow.status, EscrowStatus::Created);
    assert_eq!(escrow.milestones.len(), 3);

    // Verify Create Event (Refactored Schema)
    let events = env.events().all();
    let event = events.last().unwrap();
    assert_eq!(event.0, contract_id);

    // Topics assertion: Convert tuple to Vec<Val>
    let expected_topics: soroban_sdk::Vec<soroban_sdk::Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "EscrowCreated"),
        escrow_id,
    )
        .into_val(&env);
    assert_eq!(event.1, expected_topics);

    // Payload assertion: Convert event.2 into a Vec<Val> and compare with expected Vec<Val>
    let actual_payload: soroban_sdk::Vec<soroban_sdk::Val> = event.2.into_val(&env);
    let expected_payload: soroban_sdk::Vec<soroban_sdk::Val> = vec![
        &env,
        depositor.clone().into_val(&env),
        recipient.clone().into_val(&env),
        token_address.clone().into_val(&env),
        10000i128.into_val(&env),
        deadline.into_val(&env),
    ];
    assert_eq!(actual_payload, expected_payload);

    assert_eq!(escrow.deadline, deadline);

    assert_eq!(token_client.balance(&depositor), 10000);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&recipient), 0);
}

#[test]
fn test_deposit_funds() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 2u64;

    // Setup token - get admin client for minting
    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);

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
    // Assert balance is 10_000
    assert_eq!(token_client.balance(&depositor), 10_000);
    assert_eq!(token_client.balance(&contract_id), 10_000);
}

#[test]
fn test_release_milestone_with_tokens() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 3u64;

    // Initialize treasury (fee-free for test)
    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    // Setup token
    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);

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

    // Depositor releases first milestone
    client.release_milestone(&escrow_id, &0);

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

    assert_eq!(token_client.balance(&contract_id), 4000);
    assert_eq!(token_client.balance(&recipient), 6000);
}

#[test]
#[should_panic(expected = "Error(Contract, #9)")]
fn test_dispute_blocks_release() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 9u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &1000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 500,
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

    client.raise_dispute(&escrow_id, &depositor);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Disputed);

    client.release_milestone(&escrow_id, &0);
}

#[test]
fn test_complete_escrow_with_all_releases() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 4u64;

    // Setup token
    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
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

    client.complete_escrow(&escrow_id);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Completed);
    assert_eq!(escrow.total_released, 10_000);
}

#[test]
fn test_cancel_escrow_with_refund() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 5u64;

    // Setup token
    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

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

    let contract_id = env.register_contract(None, VaultixEscrow);
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
fn test_admin_resolves_dispute_to_recipient() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 10u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    client.init(&admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 4000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Phase1"),
        },
        Milestone {
            amount: 6000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Phase2"),
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

    token_client.approve(&depositor, &contract_id, &10000, &200);
    client.deposit_funds(&escrow_id);

    client.raise_dispute(&escrow_id, &recipient);

    client.resolve_dispute(&escrow_id, &recipient);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(escrow.resolution, Resolution::Recipient);
    assert_eq!(escrow.total_released, escrow.total_amount);
    assert!(escrow
        .milestones
        .iter()
        .all(|m| m.status == MilestoneStatus::Released));

    assert_eq!(token_client.balance(&recipient), 10000);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&depositor), 0);
}

#[test]
fn test_admin_resolves_dispute_to_depositor() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 11u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &5000);

    client.init(&admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 2000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Alpha"),
        },
        Milestone {
            amount: 3000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Beta"),
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

    token_client.approve(&depositor, &contract_id, &5000, &200);
    client.deposit_funds(&escrow_id);

    client.raise_dispute(&escrow_id, &depositor);

    client.resolve_dispute(&escrow_id, &depositor);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(escrow.resolution, Resolution::Depositor);
    assert_eq!(escrow.total_released, 0);
    assert!(escrow
        .milestones
        .iter()
        .all(|m| m.status == MilestoneStatus::Disputed));

    assert_eq!(token_client.balance(&depositor), 5000);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&recipient), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #2)")]
fn test_duplicate_escrow_id() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 7u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
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
        &token_address,
        &milestones,
        &1706400000u64,
    );
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

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    // Initialize treasury
    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 8u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
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
    client.release_milestone(&escrow_id, &0);

    // Second release should fail with MilestoneAlreadyReleased
    let result = client.try_release_milestone(&escrow_id, &0);
    assert_eq!(result, Err(Ok(Error::MilestoneAlreadyReleased)));
}

#[test]
#[should_panic(expected = "Error(Contract, #10)")]
fn test_too_many_milestones() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 9u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let mut milestones = Vec::new(&env);
    for _i in 0..21 {
        milestones.push_back(Milestone {
            amount: 100,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        });
    }

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

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 10u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 0, // Invalid: zero amount
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
}

#[test]
#[should_panic(expected = "Error(Contract, #5)")]
fn test_unauthorized_confirm_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let non_buyer = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 9u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
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
        &token_address,
        &milestones,
        &1706400000u64,
    );

    token_client.approve(&buyer, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);

    client.confirm_delivery(&escrow_id, &0, &non_buyer);
}

#[test]
#[should_panic(expected = "Error(Contract, #4)")]
fn test_double_confirm_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 10u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
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
        &token_address,
        &milestones,
        &1706400000u64,
    );

    token_client.approve(&buyer, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);

    client.confirm_delivery(&escrow_id, &0, &buyer);

    client.confirm_delivery(&escrow_id, &0, &buyer);
}

#[test]
fn test_zero_amount_milestone_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 11u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 0,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Test"),
        },
    ];

    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    assert_eq!(result, Err(Ok(Error::ZeroAmount)));
}

#[test]
fn test_negative_amount_milestone_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 12u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: -1000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Test"),
        },
    ];

    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    assert_eq!(result, Err(Ok(Error::ZeroAmount)));
}

#[test]
fn test_self_dealing_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let same_party = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 13u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&same_party, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    let result = client.try_create_escrow(
        &escrow_id,
        &same_party,
        &same_party,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    assert_eq!(result, Err(Ok(Error::SelfDealing)));
}

#[test]
fn test_valid_escrow_creation_succeeds() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 14u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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

    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
    );

    assert!(result.is_ok());

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

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 15u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);

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

    let contract_id = env.register_contract(None, VaultixEscrow);
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
    client.release_milestone(&escrow_id, &0);
}
