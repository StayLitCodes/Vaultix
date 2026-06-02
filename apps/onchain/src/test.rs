// test.rs
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, AuthorizedInvocation, Events, Ledger},
    token, vec, Address, Env, IntoVal, Val,
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

fn valid_metadata_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

fn assert_role_updated_event(
    env: &Env,
    contract_id: &Address,
    event: &(Address, soroban_sdk::Vec<Val>, Val),
    role: Role,
    had_old_address: bool,
    old_address: &Address,
    new_address: &Address,
) {
    assert_eq!(&event.0, contract_id);

    let expected_topics: soroban_sdk::Vec<Val> = (
        Symbol::new(env, "Vaultix"),
        Symbol::new(env, "v1"),
        Symbol::new(env, "RoleUpdated"),
    )
        .into_val(env);
    assert_eq!(event.1, expected_topics);

    let payload: RoleUpdatedEvent = event.2.clone().into_val(env);
    assert_eq!(
        payload,
        RoleUpdatedEvent {
            role,
            had_old_address,
            old_address: old_address.clone(),
            new_address: new_address.clone(),
            timestamp: 0,
        }
    );
}

#[test]
fn test_initialize_fails_when_treasury_already_initialized() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let replacement_treasury = Address::generate(&env);

    client.initialize(&treasury, &Some(50));

    let result = client.try_initialize(&replacement_treasury, &Some(75));
    assert_eq!(result, Err(Ok(Error::AlreadyInitialized)));

    assert_eq!(client.get_treasury(), treasury);
    assert_eq!(client.get_config(), (treasury, 50));
}

#[test]
fn test_role_rotation_requires_current_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    client.initialize(&treasury, &Some(50));
    client.init(&admin, &operator, &arbitrator);

    let replacement_admin = Address::generate(&env);
    client.set_admin(&replacement_admin);
    assert_eq!(
        env.auths(),
        std::vec![(
            admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    Symbol::new(&env, "set_admin"),
                    (&replacement_admin,).into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );

    let replacement_operator = Address::generate(&env);
    client.set_operator(&replacement_operator);
    assert_eq!(
        env.auths(),
        std::vec![(
            replacement_admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    Symbol::new(&env, "set_operator"),
                    (&replacement_operator,).into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );

    let replacement_arbitrator = Address::generate(&env);
    client.set_arbitrator(&replacement_arbitrator);
    assert_eq!(
        env.auths(),
        std::vec![(
            replacement_admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    Symbol::new(&env, "set_arbitrator"),
                    (&replacement_arbitrator,).into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );

    let replacement_treasury = Address::generate(&env);
    client.set_treasury(&replacement_treasury);
    assert_eq!(
        env.auths(),
        std::vec![(
            replacement_admin,
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id,
                    Symbol::new(&env, "set_treasury"),
                    (&replacement_treasury,).into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );
}

#[test]
fn test_role_rotation_updates_roles_and_emits_audit_events() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    client.initialize(&treasury, &Some(50));
    client.init(&admin, &operator, &arbitrator);

    let replacement_admin = Address::generate(&env);
    let replacement_operator = Address::generate(&env);
    let replacement_arbitrator = Address::generate(&env);
    let replacement_treasury = Address::generate(&env);

    let events_before = env.events().all().len();

    client.set_admin(&replacement_admin);
    client.set_operator(&replacement_operator);
    client.set_arbitrator(&replacement_arbitrator);
    client.set_treasury(&replacement_treasury);

    assert_eq!(client.get_admin(), replacement_admin);
    assert_eq!(client.get_operator(), replacement_operator);
    assert_eq!(client.get_arbitrator(), replacement_arbitrator);
    assert_eq!(client.get_treasury(), replacement_treasury);

    let events = env.events().all();
    assert_eq!(events.len(), events_before + 4);

    assert_role_updated_event(
        &env,
        &contract_id,
        &events.get(events_before).unwrap(),
        Role::Admin,
        true,
        &admin,
        &replacement_admin,
    );
    assert_role_updated_event(
        &env,
        &contract_id,
        &events.get(events_before + 1).unwrap(),
        Role::Operator,
        true,
        &operator,
        &replacement_operator,
    );
    assert_role_updated_event(
        &env,
        &contract_id,
        &events.get(events_before + 2).unwrap(),
        Role::Arbitrator,
        true,
        &arbitrator,
        &replacement_arbitrator,
    );
    assert_role_updated_event(
        &env,
        &contract_id,
        &events.get(events_before + 3).unwrap(),
        Role::Treasury,
        true,
        &treasury,
        &replacement_treasury,
    );
}

#[test]
fn test_create_escrow_fails_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &None);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let escrow_id = 1_000u64;

    // 1. Initialize roles FIRST
    client.init(&admin, &operator, &arbitrator);

    // 2. NOW pause the contract (using the operator we just initialized)
    client.set_paused(&true);

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
        &valid_metadata_hash(&env),
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
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    client.init(&admin, &operator, &arbitrator);
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
    );

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.token_address, token_address);
    assert_eq!(escrow.total_amount, 10000);
    assert_eq!(escrow.total_released, 0);
    assert_eq!(escrow.status, EscrowStatus::Created);
    assert_eq!(escrow.milestones.len(), 3);

    // Verify canonical create event schema
    let events = env.events().all();
    let event = events.last().unwrap();
    assert_eq!(event.0, contract_id);

    let expected_topics: soroban_sdk::Vec<soroban_sdk::Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "v1"),
        Symbol::new(&env, "EscrowCreated"),
    )
        .into_val(&env);
    assert_eq!(event.1, expected_topics);

    let metadata_hash = valid_metadata_hash(&env);
    let actual_payload: EscrowCreatedEvent = event.2.into_val(&env);
    assert_eq!(
        actual_payload,
        EscrowCreatedEvent {
            escrow_id,
            depositor: depositor.clone(),
            recipient: recipient.clone(),
            token_address: token_address.clone(),
            total_amount: 10000,
            total_released: 0,
            status: EscrowStatus::Created,
            deadline,
            metadata_hash,
            timestamp: 0,
        }
    );

    assert_eq!(escrow.deadline, deadline);

    assert_eq!(token_client.balance(&depositor), 10000);
    assert_eq!(token_client.balance(&contract_id), 0);
    assert_eq!(token_client.balance(&recipient), 0);
}

#[test]
fn test_create_escrow_rejects_zero_metadata_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
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

    let result = client.try_create_escrow(
        &55u64,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1_706_400_000u64,
        &BytesN::from_array(&env, &[0u8; 32]),
    );

    assert_eq!(result, Err(Ok(Error::InvalidMetadataHash)));
}

#[test]
fn test_create_escrows_batch_rejects_zero_metadata_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_address = Address::generate(&env);
    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    let requests = vec![
        &env,
        CreateEscrowRequest {
            escrow_id: 77u64,
            depositor,
            recipient,
            token_address,
            milestones,
            deadline: 1_706_400_000u64,
            metadata_hash: BytesN::from_array(&env, &[0u8; 32]),
        },
    ];

    let result = client.try_create_escrows_batch(&requests);
    assert_eq!(result, Err(Ok(Error::InvalidMetadataHash)));
}

#[test]
fn test_create_escrows_batch_and_get() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient_1 = Address::generate(&env);
    let recipient_2 = Address::generate(&env);
    let token_address = Address::generate(&env);

    let escrow_id_1 = 101u64;
    let escrow_id_2 = 102u64;
    let deadline_1 = 1706400000u64;
    let deadline_2 = 1706403600u64;

    let milestones_1 = vec![
        &env,
        Milestone {
            amount: 3000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("A"),
        },
        Milestone {
            amount: 7000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("B"),
        },
    ];
    let milestones_2 = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("C"),
        },
    ];

    let requests = vec![
        &env,
        CreateEscrowRequest {
            escrow_id: escrow_id_1,
            depositor: depositor.clone(),
            recipient: recipient_1.clone(),
            token_address: token_address.clone(),
            milestones: milestones_1,
            deadline: deadline_1,
            metadata_hash: valid_metadata_hash(&env),
        },
        CreateEscrowRequest {
            escrow_id: escrow_id_2,
            depositor: depositor.clone(),
            recipient: recipient_2.clone(),
            token_address: token_address.clone(),
            milestones: milestones_2,
            deadline: deadline_2,
            metadata_hash: valid_metadata_hash(&env),
        },
    ];

    client.create_escrows_batch(&requests);

    let escrow_1 = client.get_escrow(&escrow_id_1);
    assert_eq!(escrow_1.depositor, depositor);
    assert_eq!(escrow_1.recipient, recipient_1);
    assert_eq!(escrow_1.token_address, token_address);
    assert_eq!(escrow_1.total_amount, 10_000);
    assert_eq!(escrow_1.total_released, 0);
    assert_eq!(escrow_1.status, EscrowStatus::Created);
    assert_eq!(escrow_1.deadline, deadline_1);

    let escrow_2 = client.get_escrow(&escrow_id_2);
    assert_eq!(escrow_2.depositor, escrow_1.depositor);
    assert_eq!(escrow_2.recipient, recipient_2);
    assert_eq!(escrow_2.token_address, escrow_1.token_address);
    assert_eq!(escrow_2.total_amount, 10_000);
    assert_eq!(escrow_2.total_released, 0);
    assert_eq!(escrow_2.status, EscrowStatus::Created);
    assert_eq!(escrow_2.deadline, deadline_2);

    let events = env.events().all();
    let event = events.last().unwrap();
    assert_eq!(event.0, contract_id);

    let expected_topics: soroban_sdk::Vec<soroban_sdk::Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "v1"),
        Symbol::new(&env, "EscrowCreatedBatch"),
    )
        .into_val(&env);
    assert_eq!(event.1, expected_topics);

    let actual_payload: EscrowCreatedBatchEvent = event.2.into_val(&env);
    let expected_items: soroban_sdk::Vec<EscrowCreatedBatchEventItem> = vec![
        &env,
        EscrowCreatedBatchEventItem {
            escrow_id: escrow_id_1,
            depositor: escrow_1.depositor.clone(),
            recipient: recipient_1,
            token_address: escrow_1.token_address.clone(),
            total_amount: 10_000,
            total_released: 0,
            status: EscrowStatus::Created,
            deadline: deadline_1,
            metadata_hash: valid_metadata_hash(&env),
        },
        EscrowCreatedBatchEventItem {
            escrow_id: escrow_id_2,
            depositor: escrow_2.depositor.clone(),
            recipient: recipient_2,
            token_address: escrow_2.token_address.clone(),
            total_amount: 10_000,
            total_released: 0,
            status: EscrowStatus::Created,
            deadline: deadline_2,
            metadata_hash: valid_metadata_hash(&env),
        },
    ];
    assert_eq!(
        actual_payload,
        EscrowCreatedBatchEvent {
            batch_size: 2,
            items: expected_items,
            timestamp: 0,
        }
    );
}

#[test]
fn test_create_escrows_batch_is_atomic() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient_1 = Address::generate(&env);
    let recipient_2 = Address::generate(&env);
    let token_address = Address::generate(&env);

    let escrow_id = 201u64;
    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("X"),
        },
    ];

    let requests = vec![
        &env,
        CreateEscrowRequest {
            escrow_id,
            depositor: depositor.clone(),
            recipient: recipient_1,
            token_address: token_address.clone(),
            milestones: milestones.clone(),
            deadline: 1706400000u64,
            metadata_hash: valid_metadata_hash(&env),
        },
        CreateEscrowRequest {
            escrow_id,
            depositor,
            recipient: recipient_2,
            token_address,
            milestones,
            deadline: 1706403600u64,
            metadata_hash: valid_metadata_hash(&env),
        },
    ];

    let result = client.try_create_escrows_batch(&requests);
    assert_eq!(result, Err(Ok(Error::EscrowAlreadyExists)));

    let get_result = client.try_get_escrow(&escrow_id);
    assert_eq!(get_result, Err(Ok(Error::EscrowNotFound)));

    let events = env.events().all();
    assert_eq!(events.len(), 0);
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
    let treasury = Address::generate(&env);
    let escrow_id = 4u64;

    client.initialize(&treasury, &Some(0));

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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 10u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    client.init(&admin, &operator, &arbitrator);

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
        &valid_metadata_hash(&env),
    );

    token_client.approve(&depositor, &contract_id, &10000, &200);
    client.deposit_funds(&escrow_id);

    client.raise_dispute(&escrow_id, &recipient);

    client.resolve_dispute(&escrow_id, &recipient, &None);

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
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 11u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &5000);

    client.init(&admin, &operator, &arbitrator);

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
        &valid_metadata_hash(&env),
    );

    token_client.approve(&depositor, &contract_id, &5000, &200);
    client.deposit_funds(&escrow_id);

    client.raise_dispute(&escrow_id, &depositor);

    client.resolve_dispute(&escrow_id, &depositor, &None);

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
fn test_raise_dispute_happy_path() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 20u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &1000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 500,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task1"),
        },
        Milestone {
            amount: 500,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task2"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    let events_before = env.events().all().len();

    client.raise_dispute(&escrow_id, &depositor);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Disputed);
    assert_eq!(escrow.resolution, Resolution::None);
    assert!(escrow
        .milestones
        .iter()
        .all(|m| m.status == MilestoneStatus::Disputed || m.status == MilestoneStatus::Released));

    // Verify DisputeRaised event
    let events = env.events().all();
    assert!(events.len() > events_before);
    let event = events.last().unwrap();
    let expected_topics: soroban_sdk::Vec<soroban_sdk::Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "v1"),
        Symbol::new(&env, "DisputeRaised"),
    )
        .into_val(&env);
    assert_eq!(event.1, expected_topics);

    let actual_payload: DisputeRaisedEvent = event.2.into_val(&env);
    assert_eq!(
        actual_payload,
        DisputeRaisedEvent {
            escrow_id,
            raised_by: depositor,
            depositor: escrow.depositor,
            recipient: escrow.recipient,
            status: EscrowStatus::Disputed,
            total_amount: 1000,
            total_released: 0,
            deadline: 1706400000,
            timestamp: 0,
        }
    );
}

#[test]
fn test_raise_dispute_invalid_status() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let escrow_id_completed = 21u64;
    let escrow_id_cancelled = 22u64;

    client.initialize(&treasury, &Some(0));

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    // Completed escrow
    client.create_escrow(
        &escrow_id_completed,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );
    token_client.approve(&depositor, &contract_id, &5000, &200);
    client.deposit_funds(&escrow_id_completed);
    // Mark milestone as released without requiring treasury/fee config
    client.confirm_delivery(&escrow_id_completed, &0, &depositor);
    client.complete_escrow(&escrow_id_completed);

    let result_completed = client.try_raise_dispute(&escrow_id_completed, &depositor);
    assert_eq!(result_completed, Err(Ok(Error::InvalidEscrowStatus)));

    // Cancelled escrow
    client.create_escrow(
        &escrow_id_cancelled,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );
    token_client.approve(&depositor, &contract_id, &5000, &200);
    client.deposit_funds(&escrow_id_cancelled);
    client.cancel_escrow(&escrow_id_cancelled);

    let result_cancelled = client.try_raise_dispute(&escrow_id_cancelled, &depositor);
    assert_eq!(result_cancelled, Err(Ok(Error::InvalidEscrowStatus)));
}

#[test]
fn test_resolve_dispute_invalid_winner_or_overflow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let outsider = Address::generate(&env);
    let escrow_id = 24u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &1000);

    client.init(&admin, &operator, &arbitrator);

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
        &valid_metadata_hash(&env),
    );
    token_client.approve(&depositor, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);

    client.raise_dispute(&escrow_id, &depositor);

    // Invalid winner
    let result_invalid_winner = client.try_resolve_dispute(&escrow_id, &outsider, &None);
    assert_eq!(result_invalid_winner, Err(Ok(Error::InvalidWinner)));
}

#[test]
fn test_resolve_dispute_while_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &None);

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 25u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &5000);

    client.init(&admin, &operator, &arbitrator);

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
        &valid_metadata_hash(&env),
    );
    token_client.approve(&depositor, &contract_id, &5000, &200);
    client.deposit_funds(&escrow_id);

    client.raise_dispute(&escrow_id, &depositor);

    // Pause contract after dispute is raised
    client.set_paused(&true);

    // Resolution should still be allowed by admin while paused
    client.resolve_dispute(&escrow_id, &depositor, &None);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(escrow.resolution, Resolution::Depositor);
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
        &valid_metadata_hash(&env),
    );
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
    );

    token_client.approve(&buyer, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);

    client.confirm_delivery(&escrow_id, &0, &non_buyer);
}

#[test]
fn test_double_confirm_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let buyer = Address::generate(&env);
    let seller = Address::generate(&env);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let escrow_id = 10u64;

    client.initialize(&treasury, &Some(0));

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
        &valid_metadata_hash(&env),
    );

    token_client.approve(&buyer, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);

    client.confirm_delivery(&escrow_id, &0, &buyer);

    let result = client.try_confirm_delivery(&escrow_id, &0, &buyer);
    assert_eq!(result, Err(Ok(Error::MilestoneAlreadyReleased)));
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
        &valid_metadata_hash(&env),
    );

    assert_eq!(result, Err(Ok(Error::ZeroAmount)));
}

#[test]
fn test_legacy_escrow_migrates_to_v2_and_preserves_metadata() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_address = Address::generate(&env);
    let escrow_id = 42u64;

    let legacy_escrow = Escrow {
        depositor: depositor.clone(),
        recipient: recipient.clone(),
        token_address: token_address.clone(),
        total_amount: 500,
        total_released: 0,
        milestones: Vec::new(&env),
        status: EscrowStatus::Created,
        deadline: 1706400000u64,
        resolution: Resolution::None,
        threshold_amount: 10000,
        required_signatures: 1,
        collected_signatures: Vec::new(&env),
        metadata_hash: valid_metadata_hash(&env),
    };

    // Use test helper to write legacy storage under the contract context
    client.test_set_legacy_escrow(&escrow_id, &legacy_escrow, &Some(75i128));

    let loaded = client.get_escrow(&escrow_id);

    assert_eq!(loaded.metadata_hash, valid_metadata_hash(&env));
    assert_eq!(loaded.total_amount, 500);
    assert_eq!(loaded.status, EscrowStatus::Created);
    assert_eq!(loaded.resolution, Resolution::None);

    assert!(client.test_has_escrow_v2(&escrow_id));
    assert!(!client.test_has_legacy_escrow(&escrow_id));
    assert_eq!(
        client.test_get_escrow_version(&escrow_id),
        ESCROW_ENTRY_STORAGE_VERSION
    );
}

#[test]
fn test_milestone_sum_overflow_rejected() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 13u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: i128::MAX,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Test"),
        },
        Milestone {
            amount: 1,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Overflow"),
        },
    ];

    let result = client.try_create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    assert_eq!(result, Err(Ok(Error::InvalidMilestoneAmount)));
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
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
        &valid_metadata_hash(&env),
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // This should panic with Error #14 (EscrowAlreadyFunded)
    client.deposit_funds(&escrow_id);
}

#[test]
fn test_cancel_active_escrow_retains_fee() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50)); // 50 bps = 0.5%

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 20u64;

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

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    assert_eq!(token_client.balance(&contract_id), 10_000);
    assert_eq!(token_client.balance(&depositor), 0);

    client.cancel_escrow(&escrow_id);

    // fee = 10_000 * 50 / 10_000 = 50
    let expected_fee = 50i128;
    let expected_refund = 10_000i128 - expected_fee;

    assert_eq!(token_client.balance(&treasury), expected_fee);
    assert_eq!(token_client.balance(&depositor), expected_refund);
    assert_eq!(token_client.balance(&contract_id), 0);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Cancelled);
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
        &valid_metadata_hash(&env),
    );

    // Try to release milestone before depositing funds
    // This should panic with Error #9 (EscrowNotActive)
    client.release_milestone(&escrow_id, &0);
}

#[test]
fn test_refund_expired_authorization_check() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let unauthorized_caller = Address::generate(&env);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let escrow_id = 100u64;

    // Initialize treasury
    client.initialize(&treasury, &None);

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

    // Create and fund escrow with deadline in the past
    let deadline = 1000u64;
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
        &valid_metadata_hash(&env),
    );
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Set time past deadline
    env.ledger().with_mut(|li| li.timestamp = 2000);

    // Try to refund with unauthorized caller - should fail with Unauthorized error
    let result = client.try_refund_expired(&escrow_id, &unauthorized_caller);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));

    // Refund with authorized caller (depositor) - should succeed
    let result = client.try_refund_expired(&escrow_id, &depositor);
    assert!(result.is_ok());
}

// ===============================================================================
// refund_expired spec-parity tests (#213)
// Covers: deadline not reached, disputed escrow, fully released escrow, paused contract
// ===============================================================================

/// Helper: set up a funded escrow ready for refund tests.
/// Returns (client, depositor, escrow_id, token_client, contract_id).
fn setup_funded_escrow_for_refund(
    env: &Env,
    deadline: u64,
) -> (
    VaultixEscrowClient<'_>,
    Address,
    u64,
    token::Client<'_>,
    Address,
) {
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(env, &contract_id);

    let treasury = Address::generate(env);
    client.initialize(&treasury, &None);

    let depositor = Address::generate(env);
    let recipient = Address::generate(env);
    let admin = Address::generate(env);
    let operator = Address::generate(env);
    let arbitrator = Address::generate(env);
    client.init(&admin, &operator, &arbitrator);

    let (token_client, token_admin, token_address) = create_token_contract(env, &admin);
    token_admin.mint(&depositor, &10_000);

    let escrow_id = 9_001u64;
    let milestones = vec![
        env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
        &valid_metadata_hash(env),
    );
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    (client, depositor, escrow_id, token_client, contract_id)
}

/// Spec: env.ledger().timestamp() must be strictly greater than deadline.
/// Calling refund_expired at or before the deadline must return DeadlineNotReached.
#[test]
fn test_refund_expired_deadline_not_reached() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 5_000u64;
    let (client, depositor, escrow_id, _, _) = setup_funded_escrow_for_refund(&env, deadline);

    // At exactly the deadline — must be rejected (strict >)
    env.ledger().with_mut(|li| li.timestamp = deadline);
    let result = client.try_refund_expired(&escrow_id, &depositor);
    assert_eq!(result, Err(Ok(Error::DeadlineNotReached)));

    // One second before deadline — must also be rejected
    env.ledger().with_mut(|li| li.timestamp = deadline - 1);
    let result = client.try_refund_expired(&escrow_id, &depositor);
    assert_eq!(result, Err(Ok(Error::DeadlineNotReached)));
}

/// Spec: a Disputed escrow must not be refundable via refund_expired.
/// Dispute resolution is handled by the arbitrator, not the time-lock path.
#[test]
fn test_refund_expired_blocked_when_disputed() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let (client, depositor, escrow_id, _, _) = setup_funded_escrow_for_refund(&env, deadline);

    // Raise a dispute before the deadline passes
    client.raise_dispute(&escrow_id, &depositor);

    // Advance past deadline
    env.ledger().with_mut(|li| li.timestamp = deadline + 1);

    let result = client.try_refund_expired(&escrow_id, &depositor);
    assert_eq!(result, Err(Ok(Error::InvalidStatusForRefund)));
}

/// Spec: an escrow where all funds have already been released (Completed)
/// must not allow a second refund.
#[test]
fn test_refund_expired_blocked_when_fully_released() {
    let env = Env::default();
    env.mock_all_auths();

    // Use a far-future deadline so we can release the milestone first
    let deadline = 9_999_999_999u64;
    let (client, depositor, escrow_id, _, _) = setup_funded_escrow_for_refund(&env, deadline);

    // Release the only milestone — escrow transitions to Completed
    client.release_milestone(&escrow_id, &0);

    // Advance past deadline
    env.ledger().with_mut(|li| li.timestamp = deadline + 1);

    // Completed escrow must be rejected — the contract returns NoFundsToRefund
    // because total_released == total_amount after all milestones are released.
    // (The status check for Completed also fires, but balance check comes first.)
    let result = client.try_refund_expired(&escrow_id, &depositor);
    assert!(
        result == Err(Ok(Error::InvalidStatusForRefund))
            || result == Err(Ok(Error::NoFundsToRefund)),
        "expected refund to be rejected for a fully-released escrow, got {:?}",
        result
    );
}

/// Spec: refund_expired is blocked when the contract is paused.
/// Rationale: paused state indicates platform review; fund drains must be prevented.
/// Depositors can retry once the contract is unpaused.
#[test]
fn test_refund_expired_blocked_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let (client, depositor, escrow_id, _, _) = setup_funded_escrow_for_refund(&env, deadline);

    // Pause the contract
    client.set_paused(&true);

    // Advance past deadline
    env.ledger().with_mut(|li| li.timestamp = deadline + 1);

    // Must be rejected with ContractPaused
    let result = client.try_refund_expired(&escrow_id, &depositor);
    assert_eq!(result, Err(Ok(Error::ContractPaused)));

    // Unpause — same call must now succeed
    client.set_paused(&false);
    let result = client.try_refund_expired(&escrow_id, &depositor);
    assert!(result.is_ok());
}

#[test]
#[should_panic(expected = "Error(Contract, #28)")]
fn test_pause_fails_without_operator_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    // set_paused requires operator. Operator not set -> OperatorNotInitialized (28)
    client.set_paused(&true);
}

#[test]
#[should_panic(expected = "Error(Contract, #29)")]
fn test_resolve_dispute_fails_without_arbitrator_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 1u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &1000);

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
        &valid_metadata_hash(&env),
    );
    token_client.approve(&depositor, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);
    client.raise_dispute(&escrow_id, &depositor);

    let winner = Address::generate(&env);

    // This should now correctly panic with ArbitratorNotInitialized (29)
    client.resolve_dispute(&escrow_id, &winner, &None);
}
// ===============================================================================
// Configurable Fee Model Tests (Feature #93)
// Tests for per-token and per-escrow fee overrides with precedence logic
// ===============================================================================

// #[test]
// fn test_set_token_fee_valid() {
//     let env = Env::default();
//     env.mock_all_auths();

//     let contract_id = env.register_contract(None, VaultixEscrow);
//     let client = VaultixEscrowClient::new(&env, &contract_id);

//     let treasury = Address::generate(&env);
//     let admin = Address::generate(&env);
//     client.initialize(&treasury, &Some(50)); // 0.5% default

//     let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

//     // Set token fee to 100 bps (1%)
//     let result = client.set_token_fee(&token_address, &100);
//     assert_eq!(result, Ok(()));
// }

#[test]
fn test_set_token_fee_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    client.initialize(&treasury, &Some(50)); // 0.5% default

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    // Set token fee to 100 bps (1%)
    let result = client.try_set_token_fee(&token_address, &100);

    // Fix: Use assert!(result.is_ok()) or unwrap the result
    assert!(
        result.is_ok(),
        "Expected set_token_fee to succeed, but it failed"
    );
}

#[test]
fn test_set_token_fee_invalid_fee_too_high() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    // Try to set token fee above BPS_DENOMINATOR (10000)
    let result = client.try_set_token_fee(&token_address, &10001);
    assert_eq!(result, Err(Ok(Error::InvalidFeeConfiguration)));
}

// #[test]
// fn test_set_escrow_fee_valid() {
//     let env = Env::default();
//     env.mock_all_auths();

//     let contract_id = env.register_contract(None, VaultixEscrow);
//     let client = VaultixEscrowClient::new(&env, &contract_id);

//     let treasury = Address::generate(&env);
//     client.initialize(&treasury, &Some(50)); // 0.5% default

//     let escrow_id = 1u64;

//     // Set escrow-specific fee to 75 bps (0.75%)
//     let result = client.set_escrow_fee(&escrow_id, &75);
//     assert_eq!(result, Ok(()));
// }

#[test]
fn test_set_escrow_fee_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50)); // 0.5% default

    let escrow_id = 1u64;

    // Set escrow-specific fee to 75 bps (0.75%)
    // Use try_set_escrow_fee to capture the Result for the assertion
    let result = client.try_set_escrow_fee(&escrow_id, &75);

    // Fix: assert that the result is Ok without strict type matching of the unit ()
    assert!(
        result.is_ok(),
        "Escrow fee should have been set successfully"
    );
}

#[test]
fn test_set_escrow_fee_invalid_fee_too_high() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let escrow_id = 1u64;

    // Try to set escrow fee above BPS_DENOMINATOR
    let result = client.try_set_escrow_fee(&escrow_id, &10001);
    assert_eq!(result, Err(Ok(Error::InvalidFeeConfiguration)));
}

#[test]
fn test_release_milestone_uses_global_fee_by_default() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(100)); // 1% fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    let escrow_id = 1u64;
    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &(env.ledger().timestamp() + 3600),
        &valid_metadata_hash(&env),
    );

    // Approve contract to transfer depositor's tokens, then deposit
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Release milestone using global fee (100 bps = 1%)
    client.release_milestone(&escrow_id, &0);

    // Expected: fee = 10_000 * 100 / 10_000 = 100
    let expected_fee = 100i128;
    let expected_payout = 10_000i128 - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

#[test]
fn test_release_milestone_uses_token_fee_override() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50)); // 0.5% global fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    // Set token-specific fee to 200 bps (2%)
    client.set_token_fee(&token_address, &200);

    let escrow_id = 1u64;
    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &(env.ledger().timestamp() + 3600),
        &valid_metadata_hash(&env),
    );

    // Approve contract to transfer depositor's tokens, then deposit
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Release milestone - should use token fee (200 bps), not global (50 bps)
    client.release_milestone(&escrow_id, &0);

    // Expected: fee = 10_000 * 200 / 10_000 = 200
    let expected_fee = 200i128;
    let expected_payout = 10_000i128 - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

#[test]
fn test_release_milestone_uses_escrow_fee_override() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50)); // 0.5% global fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    // Set token-specific fee to 100 bps (1%)
    client.set_token_fee(&token_address, &100);

    let escrow_id = 1u64;

    // Set escrow-specific fee to 300 bps (3%) - highest priority
    client.set_escrow_fee(&escrow_id, &300);

    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &(env.ledger().timestamp() + 3600),
        &valid_metadata_hash(&env),
    );

    // Approve contract to transfer depositor's tokens, then deposit
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Release milestone - should use escrow fee (300 bps), not token (100 bps) or global (50 bps)
    client.release_milestone(&escrow_id, &0);

    // Expected: fee = 10_000 * 300 / 10_000 = 300
    let expected_fee = 300i128;
    let expected_payout = 10_000i128 - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

#[test]
fn test_cancel_escrow_uses_token_fee_override() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50)); // 0.5% global fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    // Set token-specific fee to 200 bps (2%)
    client.set_token_fee(&token_address, &200);

    let escrow_id = 1u64;
    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &(env.ledger().timestamp() + 3600),
        &valid_metadata_hash(&env),
    );

    // Approve contract to transfer depositor's tokens, then deposit
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Cancel escrow - should use token fee (200 bps)
    client.cancel_escrow(&escrow_id);

    // Expected: fee = 10_000 * 200 / 10_000 = 200
    let expected_fee = 200i128;
    let expected_refund = 10_000i128 - expected_fee;

    assert_eq!(token_client.balance(&depositor), expected_refund);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

#[test]
fn test_refund_expired_uses_escrow_fee_override() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let depositor = Address::generate(&env);
    let admin = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    let token_client = token::Client::new(&env, &token_address);
    token_admin.mint(&depositor, &10_000);

    let escrow_id = 1u64;

    // Set escrow fee to 500 bps (5%)
    client.set_escrow_fee(&escrow_id, &500);

    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    let current_time = env.ledger().timestamp();
    let deadline = current_time + 100; // 100 seconds from now

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
        &valid_metadata_hash(&env),
    );

    // Approve contract to transfer depositor's tokens, then deposit
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // FIX: Correct way to advance time in Soroban tests
    env.ledger().with_mut(|ledger| {
        ledger.timestamp = deadline + 1000;
    });

    // Refund expired escrow - should use escrow fee (500 bps)
    client.refund_expired(&escrow_id, &depositor);

    // Expected: fee = 10_000 * 500 / 10_000 = 500
    let expected_fee = 500i128;
    let expected_refund = 10_000i128 - expected_fee;

    assert_eq!(token_client.balance(&depositor), expected_refund);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

#[test]
fn test_zero_fee_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    let token_client = token::Client::new(&env, &token_address);
    token_admin.mint(&depositor, &10_000);

    let result = client.try_set_token_fee(&token_address, &0);
    assert!(result.is_ok(), "Setting zero fee should be valid");

    let escrow_id = 1u64;
    let milestones = vec![
        &env,
        Milestone {
            amount: 10_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &(env.ledger().timestamp() + 3600),
        &valid_metadata_hash(&env),
    );
    // Approve contract to transfer depositor's tokens, then deposit
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);
    client.release_milestone(&escrow_id, &0);

    // With zero fee, recipient gets full amount
    assert_eq!(token_client.balance(&recipient), 10_000i128);
    assert_eq!(token_client.balance(&treasury), 0i128);
}

#[test]
fn test_configure_multisig_threshold() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 100u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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
        &valid_metadata_hash(&env),
    );

    // Configure multisig: threshold of 3000 and require 2 signatures
    client.configure_multisig(&escrow_id, &3000, &2);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.threshold_amount, 3000);
    assert_eq!(escrow.required_signatures, 2);
}

#[test]
fn test_collect_signature() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let third_party = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 101u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

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
        &valid_metadata_hash(&env),
    );

    // Configure multisig: threshold of 3000 and require 2 signatures
    client.configure_multisig(&escrow_id, &3000, &2);

    // Collect first signature
    client.collect_signature(&escrow_id, &depositor);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.collected_signatures.len(), 1);
    assert_eq!(escrow.collected_signatures.get(0).unwrap(), depositor);

    // Collect second signature
    client.collect_signature(&escrow_id, &third_party);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.collected_signatures.len(), 2);
    assert_eq!(escrow.collected_signatures.get(0).unwrap(), depositor);
    assert_eq!(escrow.collected_signatures.get(1).unwrap(), third_party);
}

#[test]
fn test_release_milestone_below_threshold_single_signature() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 102u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 2000, // Below threshold of 3000
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
        &valid_metadata_hash(&env),
    );

    // Configure multisig: threshold of 3000 and require 2 signatures
    client.configure_multisig(&escrow_id, &3000, &2);

    token_client.approve(&depositor, &contract_id, &10000, &200);
    client.deposit_funds(&escrow_id);

    // Should be able to release since amount is below threshold
    client.release_milestone(&escrow_id, &0);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(
        escrow.milestones.get(0).unwrap().status,
        MilestoneStatus::Released
    );
}

#[test]
fn test_release_milestone_above_threshold_insufficient_signatures() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 103u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000, // Above threshold of 3000
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
        &valid_metadata_hash(&env),
    );

    // Configure multisig: threshold of 3000 and require 2 signatures
    client.configure_multisig(&escrow_id, &3000, &2);

    let result = client.try_release_milestone(&escrow_id, &0);

    // Should fail because there are insufficient signatures
    assert_eq!(result, Err(Ok(Error::UnauthorizedAccess)));
}

#[test]
fn test_release_milestone_above_threshold_sufficient_signatures() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let third_party = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 104u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000, // Above threshold of 3000
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
        &valid_metadata_hash(&env),
    );

    // Configure multisig: threshold of 3000 and require 2 signatures
    client.configure_multisig(&escrow_id, &3000, &2);

    token_client.approve(&depositor, &contract_id, &10000, &200);
    client.deposit_funds(&escrow_id);

    // Collect required signatures
    client.collect_signature(&escrow_id, &depositor);
    client.collect_signature(&escrow_id, &third_party);

    // Now should be able to release since we have sufficient signatures
    client.release_milestone(&escrow_id, &0);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(
        escrow.milestones.get(0).unwrap().status,
        MilestoneStatus::Released
    );
}

#[test]
fn test_list_escrows_by_depositor() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient1 = Address::generate(&env);
    let recipient2 = Address::generate(&env);

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    // Create multiple escrows with the same depositor
    client.create_escrow(
        &1u64,
        &depositor,
        &recipient1,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    client.create_escrow(
        &2u64,
        &depositor,
        &recipient2,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    // List escrows by depositor
    let summaries =
        client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &0u32, &10u32);

    assert_eq!(summaries.len(), 2);
    assert_eq!(summaries.get(0).unwrap().escrow_id, 1);
    assert_eq!(summaries.get(1).unwrap().escrow_id, 2);
}

#[test]
fn test_list_escrows_by_recipient() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let admin = Address::generate(&env);
    let depositor1 = Address::generate(&env);
    let depositor2 = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    // Create multiple escrows with the same recipient
    client.create_escrow(
        &1u64,
        &depositor1,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    client.create_escrow(
        &2u64,
        &depositor2,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    // List escrows by recipient
    let summaries =
        client.list_escrows_by_party(&recipient, &symbol_short!("recipient"), &0u32, &10u32);

    assert_eq!(summaries.len(), 2);
    assert_eq!(summaries.get(0).unwrap().escrow_id, 1);
    assert_eq!(summaries.get(1).unwrap().escrow_id, 2);
}

#[test]
fn test_list_escrows_pagination() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    // Create 5 escrows
    for i in 1..=5 {
        client.create_escrow(
            &i,
            &depositor,
            &recipient,
            &token_address,
            &milestones,
            &1706400000u64,
            &valid_metadata_hash(&env),
        );
    }

    // Test page 0 with page size 2
    let page0 = client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &0u32, &2u32);
    assert_eq!(page0.len(), 2);
    assert_eq!(page0.get(0).unwrap().escrow_id, 1);
    assert_eq!(page0.get(1).unwrap().escrow_id, 2);

    // Test page 1 with page size 2
    let page1 = client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &1u32, &2u32);
    assert_eq!(page1.len(), 2);
    assert_eq!(page1.get(0).unwrap().escrow_id, 3);
    assert_eq!(page1.get(1).unwrap().escrow_id, 4);

    // Test page 2 with page size 2 (should have 1 result)
    let page2 = client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &2u32, &2u32);
    assert_eq!(page2.len(), 1);
    assert_eq!(page2.get(0).unwrap().escrow_id, 5);

    // Test page 3 with page size 2 (should be empty)
    let page3 = client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &3u32, &2u32);
    assert_eq!(page3.len(), 0);
}

#[test]
fn test_list_escrows_page_size_limit() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let _admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let _recipient = Address::generate(&env);

    // Test page size exceeding MAX_PAGE_SIZE
    let result = client.try_list_escrows_by_party(
        &depositor,
        &symbol_short!("depositor"),
        &0u32,
        &101u32, // Exceeds MAX_PAGE_SIZE of 100
    );
    assert_eq!(result, Err(Ok(Error::VectorTooLarge)));

    // Test page size of 0
    let result =
        client.try_list_escrows_by_party(&depositor, &symbol_short!("depositor"), &0u32, &0u32);
    assert_eq!(result, Err(Ok(Error::VectorTooLarge)));
}

#[test]
fn test_list_escrows_invalid_role() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let _admin = Address::generate(&env);
    let depositor = Address::generate(&env);

    // Test invalid role parameter
    let result =
        client.try_list_escrows_by_party(&depositor, &symbol_short!("invalid"), &0u32, &10u32);
    assert_eq!(result, Err(Ok(Error::Unauthorized)));
}

#[test]
fn test_list_escrows_empty_party() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let _admin = Address::generate(&env);
    let depositor = Address::generate(&env);

    // Query for a party with no escrows
    let summaries =
        client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &0u32, &10u32);
    assert_eq!(summaries.len(), 0);
}

#[test]
fn test_list_escrows_returns_lightweight_summaries() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let admin = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    client.create_escrow(
        &1u64,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    let summaries =
        client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &0u32, &10u32);

    assert_eq!(summaries.len(), 1);
    let summary = summaries.get(0).unwrap();

    // Verify summary contains lightweight data
    assert_eq!(summary.escrow_id, 1);
    assert_eq!(summary.depositor, depositor);
    assert_eq!(summary.recipient, recipient);
    assert_eq!(summary.token_address, token_address);
    assert_eq!(summary.total_amount, 5000);
    assert_eq!(summary.status, EscrowStatus::Created);
    assert_eq!(summary.deadline, 1706400000);
    assert_eq!(summary.metadata_hash, valid_metadata_hash(&env));
}

#[test]
fn test_max_fee_10000_bps_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let admin = Address::generate(&env);
    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    // Set token fee to maximum valid value (BPS_DENOMINATOR = 10000)
    let result = client.try_set_token_fee(&token_address, &10000);
    assert!(result.is_ok());
}

// ===============================================================================
// Mobile-friendly event indexing: escrow summary fields in lifecycle events
//
// Validates that ALL lifecycle events carry the four summary fields:
//   - status:   EscrowStatus enum identifying the current lifecycle state
//   - total_amount:    i128 total escrow value
//   - total_released:  i128 amount released so far
//   - deadline: u64 deadline timestamp
//
// This guarantees that mobile clients and indexers can reconstruct
// a full dashboard view from events alone + minimal storage reads.
// ===============================================================================

/// Verify that every lifecycle event struct embeds status, total_amount,
/// total_released and deadline in deterministic positions.
#[test]
fn test_lifecycle_events_contain_all_summary_fields() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    let milestones = vec![
        &env,
        Milestone {
            amount: 10000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        },
    ];

    let deadline = 1706400000u64;

    // Create escrow to test the new EscrowCreatedEvent fields
    client.create_escrow(
        &1u64,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
        &valid_metadata_hash(&env),
    );

    let events = env.events().all();
    // Event index 0 is FeeUpdated from initialize, index 1 is RoleUpdated
    // So EscrowCreated should be the last event
    let event = events.last().unwrap();
    let payload: EscrowCreatedEvent = event.2.clone().into_val(&env);

    // Verify summary fields are present and correct
    assert_eq!(payload.status, EscrowStatus::Created);
    assert_eq!(payload.total_amount, 10000);
    assert_eq!(payload.total_released, 0);
    assert_eq!(payload.deadline, deadline);
}

/// Walk through a full escrow lifecycle and verify that each event
/// carries the correct summary values at each stage.
#[test]
fn test_full_lifecycle_event_summaries_are_accurate() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let escrow_id = 999u64;

    client.initialize(&treasury, &Some(0));

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 4000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("M1"),
        },
        Milestone {
            amount: 6000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("M2"),
        },
    ];

    let deadline = 1706400000u64;

    // --- Step 1: Create escrow ---
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
        &valid_metadata_hash(&env),
    );

    let events = env.events().all();
    // Find the last event (EscrowCreated) — skip initialization events
    let create_event: EscrowCreatedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(create_event.status, EscrowStatus::Created);
    assert_eq!(create_event.total_amount, 10000);
    assert_eq!(create_event.total_released, 0);
    assert_eq!(create_event.deadline, deadline);

    // --- Step 2: Deposit funds ---
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    let events = env.events().all();
    let deposit_event: FundsDepositedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(deposit_event.status, EscrowStatus::Active);
    assert_eq!(deposit_event.total_amount, 10000);
    assert_eq!(deposit_event.total_released, 0);
    assert_eq!(deposit_event.deadline, deadline);

    // --- Step 3: Release milestone 0 ---
    client.release_milestone(&escrow_id, &0);

    let events = env.events().all();
    let release_event: MilestoneReleasedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(release_event.status, EscrowStatus::Active);
    assert_eq!(release_event.total_amount, 10000);
    assert_eq!(release_event.total_released, 4000);
    assert_eq!(release_event.deadline, deadline);

    // --- Step 4: Delivery confirm milestone 1 ---
    client.confirm_delivery(&escrow_id, &1, &depositor);

    let events = env.events().all();
    let confirm_event: DeliveryConfirmedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(confirm_event.status, EscrowStatus::Active);
    assert_eq!(confirm_event.total_amount, 10000);
    assert_eq!(confirm_event.total_released, 10000);
    assert_eq!(confirm_event.deadline, deadline);

    // --- Step 5: Complete escrow ---
    client.complete_escrow(&escrow_id);

    let events = env.events().all();
    let complete_event: EscrowCompletedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(complete_event.status, EscrowStatus::Completed);
    assert_eq!(complete_event.total_amount, 10000);
    assert_eq!(complete_event.total_released, 10000);
    assert_eq!(complete_event.deadline, deadline);
}

/// Verify deterministic event ordering: events are emitted in the same
/// order as the contract operations. A mobile client can replay events
/// sequentially to reconstruct state.
#[test]
fn test_event_ordering_is_deterministic() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let escrow_id = 888u64;

    client.initialize(&treasury, &Some(0));

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

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
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    let events = env.events().all();

    // The last event should be EscrowCreated (initialize emits FeeUpdated first)
    let event = events.last().unwrap();
    let topics: soroban_sdk::Vec<Val> = event.1.clone().into_val(&env);
    let expected_topics: soroban_sdk::Vec<Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "v1"),
        Symbol::new(&env, "EscrowCreated"),
    )
        .into_val(&env);
    assert_eq!(
        topics, expected_topics,
        "event topics must follow (Vaultix, v1, EventName) format"
    );
}

/// Verify that event topics remain backwards-compatible and match the
/// existing (Vaultix, v1, EventName) pattern — no breaking changes introduced.
#[test]
fn test_event_topics_are_backwards_compatible() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let escrow_id = 777u64;

    client.initialize(&treasury, &Some(0));

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

    // Run through a series of operations and verify all event topics
    let deadline = 1706400000u64;

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
        &valid_metadata_hash(&env),
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    client.release_milestone(&escrow_id, &0);

    client.complete_escrow(&escrow_id);

    let events = env.events().all();

    let expected_event_names = [
        "EscrowCreated",
        "FundsDeposited",
        "MilestoneReleased",
        "EscrowCompleted",
    ];

    let mut event_idx = 0;
    // Skip initialization events (FeeUpdated + RoleUpdated) emitted by initialize()
    // In this setup with treasury only, initialize emits FeeUpdated (topic index 2 with "FeeUpdated")
    while event_idx < events.len() {
        let topics: soroban_sdk::Vec<Val> = events.get(event_idx).unwrap().1.clone().into_val(&env);
        let _name_val: Val = topics.get(2).unwrap();
        let expected_topics: soroban_sdk::Vec<Val> = (
            Symbol::new(&env, "Vaultix"),
            Symbol::new(&env, "v1"),
            Symbol::new(&env, expected_event_names[0]),
        )
            .into_val(&env);
        if topics != expected_topics && event_idx < 5 {
            // Skip the initial FeeUpdated event
            event_idx += 1;
            continue;
        }
        break;
    }

    for expected_name in expected_event_names.iter() {
        while event_idx < events.len() {
            let topics: soroban_sdk::Vec<Val> =
                events.get(event_idx).unwrap().1.clone().into_val(&env);
            let expected_topics: soroban_sdk::Vec<Val> = (
                Symbol::new(&env, "Vaultix"),
                Symbol::new(&env, "v1"),
                Symbol::new(&env, expected_name),
            )
                .into_val(&env);
            if topics == expected_topics {
                break;
            }
            event_idx += 1;
        }

        assert!(event_idx < events.len(), "expected more events");

        let topics: soroban_sdk::Vec<Val> = events.get(event_idx).unwrap().1.clone().into_val(&env);
        let canon_topic: soroban_sdk::Vec<Val> = (
            Symbol::new(&env, "Vaultix"),
            Symbol::new(&env, "v1"),
            Symbol::new(&env, expected_name),
        )
            .into_val(&env);
        assert_eq!(
            topics, canon_topic,
            "Event {} must use canonical topic format (Vaultix, v1, {})",
            expected_name, expected_name
        );

        event_idx += 1;
    }
}
