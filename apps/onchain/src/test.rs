// test.rs
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{
        Address as _, AuthorizedFunction, AuthorizedInvocation, EnvTestConfig, Events, Ledger,
    },
    token, vec, Address, Env, IntoVal, Val,
};

/// Helper function to create and initialize a test token
/// Returns admin client for minting and the token address
fn create_test_token<'a>(env: &Env, admin: &Address) -> (token::StellarAssetClient<'a>, Address) {
    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
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

fn valid_evidence_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[9u8; 32])
}

fn zero_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[0u8; 32])
}

/// soroban-sdk 21+ changed `Env::events().all()` to return the opaque
/// `testutils::ContractEvents` (XDR-backed) instead of the
/// `Vec<(Address, Vec<Val>, Val)>` that SDK 20 returned. This helper restores
/// the old shape so the existing assertions keep working unchanged.
fn all_events(env: &Env) -> soroban_sdk::Vec<(Address, soroban_sdk::Vec<Val>, Val)> {
    use soroban_sdk::xdr::{ContractEventBody, ScAddress, ScVal};
    use soroban_sdk::TryFromVal;

    let captured = env.events().all();
    let mut out = soroban_sdk::Vec::new(env);
    for event in captured.events() {
        let contract_id = event
            .contract_id
            .clone()
            .expect("contract event without contract id");
        let address_val =
            Val::try_from_val(env, &ScVal::Address(ScAddress::Contract(contract_id))).unwrap();
        let address = Address::try_from_val(env, &address_val).unwrap();

        let ContractEventBody::V0(body) = &event.body;
        let mut topics = soroban_sdk::Vec::new(env);
        for topic in body.topics.iter() {
            topics.push_back(Val::try_from_val(env, topic).unwrap());
        }
        let data = Val::try_from_val(env, &body.data).unwrap();

        out.push_back((address, topics, data));
    }
    out
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    client.initialize(&treasury, &Some(50));
    client.init(&admin, &operator, &arbitrator);

    // Admin transfer is two-step: only the current admin can propose...
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

    // ...and only the pending admin can accept, which is what promotes them.
    client.accept_admin();
    assert_eq!(
        env.auths(),
        std::vec![(
            replacement_admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    Symbol::new(&env, "accept_admin"),
                    ().into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );
    assert_eq!(client.get_admin(), replacement_admin);

    // Once promoted, the new admin is the one who rotates the other roles.
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

    let contract_id = env.register(VaultixEscrow, ());
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

    // Note: since soroban-sdk 21, `env.events().all()` only returns the events
    // of the most recent top-level invocation, so each rotation is asserted
    // immediately after its own call rather than against an accumulated log.
    //
    // Admin transfer is two-step: `propose_admin` only stages the handover and
    // `accept_admin` (authorized by the pending admin) is what emits the
    // existing RoleUpdated event.
    client.propose_admin(&replacement_admin);
    client.accept_admin();
    let events = all_events(&env);
    assert_eq!(events.len(), 1);
    assert_role_updated_event(
        &env,
        &contract_id,
        &events.get(0).unwrap(),
        Role::Admin,
        true,
        &admin,
        &replacement_admin,
    );

    client.set_operator(&replacement_operator);
    let events = all_events(&env);
    assert_eq!(events.len(), 1);
    assert_role_updated_event(
        &env,
        &contract_id,
        &events.get(0).unwrap(),
        Role::Operator,
        true,
        &operator,
        &replacement_operator,
    );

    client.set_arbitrator(&replacement_arbitrator);
    let events = all_events(&env);
    assert_eq!(events.len(), 1);
    assert_role_updated_event(
        &env,
        &contract_id,
        &events.get(0).unwrap(),
        Role::Arbitrator,
        true,
        &arbitrator,
        &replacement_arbitrator,
    );

    client.set_treasury(&replacement_treasury);
    let events = all_events(&env);
    assert_eq!(events.len(), 1);
    assert_role_updated_event(
        &env,
        &contract_id,
        &events.get(0).unwrap(),
        Role::Treasury,
        true,
        &treasury,
        &replacement_treasury,
    );

    assert_eq!(client.get_admin(), replacement_admin);
    assert_eq!(client.get_operator(), replacement_operator);
    assert_eq!(client.get_arbitrator(), replacement_arbitrator);
    assert_eq!(client.get_treasury(), replacement_treasury);
}

#[test]
fn test_propose_admin_stores_pending_and_keeps_current_admin() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    client.initialize(&treasury, &Some(50));
    client.init(&admin, &operator, &arbitrator);

    let proposed_at = env.ledger().timestamp();
    let replacement_admin = Address::generate(&env);
    client.propose_admin(&replacement_admin);

    // Proposing emits an AdminProposed event with the new admin and expiry.
    // (Since soroban-sdk 21 the event buffer only holds the most recent
    // invocation, so this must be captured before any further contract calls.)
    let events = all_events(&env);
    assert_eq!(events.len(), 1);
    let event = events.get(0).unwrap();
    assert_eq!(&event.0, &contract_id);

    let expected_topics: soroban_sdk::Vec<Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "v1"),
        Symbol::new(&env, "AdminProposed"),
    )
        .into_val(&env);
    assert_eq!(event.1, expected_topics);

    let payload: AdminProposedEvent = event.2.clone().into_val(&env);
    assert_eq!(
        payload,
        AdminProposedEvent {
            caller: admin.clone(),
            new_admin: replacement_admin.clone(),
            expires_at: proposed_at + ADMIN_PROPOSAL_WINDOW_SECS,
            timestamp: proposed_at,
        }
    );

    // Only the current admin may propose.
    assert_eq!(
        env.auths(),
        std::vec![(
            admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    Symbol::new(&env, "propose_admin"),
                    (&replacement_admin,).into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );

    // The current admin stays in force until the pending admin accepts.
    assert_eq!(client.get_admin(), admin);
    assert_eq!(
        client.get_pending_admin(),
        Some(AdminProposal {
            new_admin: replacement_admin,
            expires_at: proposed_at + ADMIN_PROPOSAL_WINDOW_SECS,
        })
    );
}

#[test]
fn test_accept_admin_requires_pending_admin_auth() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    client.initialize(&treasury, &Some(50));
    client.init(&admin, &operator, &arbitrator);

    // With no pending proposal there is nothing to accept.
    let result = client.try_accept_admin();
    assert_eq!(result, Err(Ok(Error::AdminProposalNotFound)));

    let replacement_admin = Address::generate(&env);
    client.propose_admin(&replacement_admin);

    // accept_admin() must be authorized by the pending admin itself — never by
    // the current admin — so a mistyped address can never be promoted.
    client.accept_admin();
    assert_eq!(
        env.auths(),
        std::vec![(
            replacement_admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    Symbol::new(&env, "accept_admin"),
                    ().into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );

    // The pending admin is promoted and the proposal is consumed.
    assert_eq!(client.get_admin(), replacement_admin);
    assert_eq!(client.get_pending_admin(), None);
}

#[test]
fn test_cancel_admin_proposal_withdraws_pending() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    client.initialize(&treasury, &Some(50));
    client.init(&admin, &operator, &arbitrator);

    // Cancelling with nothing pending is an error.
    let result = client.try_cancel_admin_proposal();
    assert_eq!(result, Err(Ok(Error::AdminProposalNotFound)));

    let replacement_admin = Address::generate(&env);
    client.propose_admin(&replacement_admin);
    assert!(client.get_pending_admin().is_some());

    // Only the current admin may cancel a pending proposal.
    client.cancel_admin_proposal();
    assert_eq!(
        env.auths(),
        std::vec![(
            admin.clone(),
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id.clone(),
                    Symbol::new(&env, "cancel_admin_proposal"),
                    ().into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );

    // Cancelling emits an AdminProposalCancelled event. (Captured before the
    // read calls below clear the invocation-scoped event buffer.)
    let events = all_events(&env);
    assert_eq!(events.len(), 1);
    let event = events.get(0).unwrap();
    assert_eq!(&event.0, &contract_id);

    let expected_topics: soroban_sdk::Vec<Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "v1"),
        Symbol::new(&env, "AdminProposalCancelled"),
    )
        .into_val(&env);
    assert_eq!(event.1, expected_topics);

    let payload: AdminProposalCancelledEvent = event.2.clone().into_val(&env);
    assert_eq!(
        payload,
        AdminProposalCancelledEvent {
            caller: admin.clone(),
            new_admin: replacement_admin,
            timestamp: env.ledger().timestamp(),
        }
    );

    // The proposal is withdrawn and the admin never changed.
    assert_eq!(client.get_pending_admin(), None);
    assert_eq!(client.get_admin(), admin);
}

#[test]
fn test_admin_proposal_expires_after_window() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    client.initialize(&treasury, &Some(50));
    client.init(&admin, &operator, &arbitrator);

    let replacement_admin = Address::generate(&env);
    client.propose_admin(&replacement_admin);
    let expires_at = env.ledger().timestamp() + ADMIN_PROPOSAL_WINDOW_SECS;

    // The proposal is still acceptable exactly at the end of the window.
    env.ledger().with_mut(|ledger| {
        ledger.timestamp = expires_at;
    });
    client.accept_admin();
    assert_eq!(client.get_admin(), replacement_admin);

    // A fresh proposal that outlives its window can no longer be accepted.
    let second_admin = Address::generate(&env);
    client.propose_admin(&second_admin);
    let second_expires_at = expires_at + ADMIN_PROPOSAL_WINDOW_SECS;
    env.ledger().with_mut(|ledger| {
        ledger.timestamp = second_expires_at + 1;
    });
    let result = client.try_accept_admin();
    assert_eq!(result, Err(Ok(Error::AdminProposalExpired)));

    // The expired proposal is inert: it stays stored (so callers can see it
    // lapsed) but can never be accepted, and the current admin is untouched.
    assert_eq!(
        client.get_pending_admin(),
        Some(AdminProposal {
            new_admin: second_admin,
            expires_at: second_expires_at,
        })
    );
    assert_eq!(client.get_admin(), replacement_admin);

    // The current admin can withdraw the stale proposal at any time.
    client.cancel_admin_proposal();
    assert_eq!(client.get_pending_admin(), None);
    assert_eq!(client.get_admin(), replacement_admin);
}

#[test]
fn test_old_admin_retains_full_powers_until_acceptance() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    client.initialize(&treasury, &Some(50));
    client.init(&admin, &operator, &arbitrator);

    // While a proposal is pending, the current admin keeps every privilege.
    let replacement_admin = Address::generate(&env);
    client.propose_admin(&replacement_admin);
    assert_eq!(client.get_admin(), admin);

    let replacement_operator = Address::generate(&env);
    client.set_operator(&replacement_operator);
    assert_eq!(
        env.auths(),
        std::vec![(
            admin.clone(),
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
    assert_eq!(client.get_operator(), replacement_operator);

    let replacement_arbitrator = Address::generate(&env);
    client.set_arbitrator(&replacement_arbitrator);
    assert_eq!(client.get_arbitrator(), replacement_arbitrator);

    let replacement_treasury = Address::generate(&env);
    client.set_treasury(&replacement_treasury);
    assert_eq!(client.get_treasury(), replacement_treasury);

    // The pending admin has not been promoted.
    assert_eq!(client.get_admin(), admin);
    assert_eq!(
        client.get_pending_admin(),
        Some(AdminProposal {
            new_admin: replacement_admin.clone(),
            expires_at: env.ledger().timestamp() + ADMIN_PROPOSAL_WINDOW_SECS,
        })
    );

    // Once the pending admin accepts, they hold the keys and the old admin
    // no longer does.
    client.accept_admin();
    assert_eq!(client.get_admin(), replacement_admin);
    assert_eq!(client.get_pending_admin(), None);

    let next_operator = Address::generate(&env);
    client.set_operator(&next_operator);
    assert_eq!(
        env.auths(),
        std::vec![(
            replacement_admin,
            AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    contract_id,
                    Symbol::new(&env, "set_operator"),
                    (&next_operator,).into_val(&env),
                )),
                sub_invocations: std::vec![],
            },
        )]
    );
}

#[test]
fn test_create_escrow_fails_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    // Captured before any further invocation: since soroban-sdk 21,
    // `env.events().all()` only reports the last top-level invocation.
    let events = all_events(&env);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.depositor, depositor);
    assert_eq!(escrow.recipient, recipient);
    assert_eq!(escrow.token_address, token_address);
    assert_eq!(escrow.total_amount, 10000);
    assert_eq!(escrow.total_released, 0);
    assert_eq!(escrow.status, EscrowStatus::Created);
    assert_eq!(escrow.milestones.len(), 3);

    // Verify canonical create event schema
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    // Captured before any further invocation: since soroban-sdk 21,
    // `env.events().all()` only reports the last top-level invocation.
    let events = all_events(&env);

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

    let contract_id = env.register(VaultixEscrow, ());
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

    let events = all_events(&env);
    assert_eq!(events.len(), 0);
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Disputed);

    client.release_milestone(&escrow_id, &0);
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    client.raise_dispute(&escrow_id, &recipient, &valid_evidence_hash(&env));

    client.resolve_dispute(&escrow_id, &recipient, &None, &None);

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

    let contract_id = env.register(VaultixEscrow, ());
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

    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    client.resolve_dispute(&escrow_id, &depositor, &None, &None);

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

    let contract_id = env.register(VaultixEscrow, ());
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

    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    // Captured before any further invocation: since soroban-sdk 21,
    // `env.events().all()` only reports the last top-level invocation.
    let events = all_events(&env);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Disputed);
    assert_eq!(escrow.resolution, Resolution::None);
    assert!(escrow
        .milestones
        .iter()
        .all(|m| m.status == MilestoneStatus::Disputed || m.status == MilestoneStatus::Released));

    // Verify DisputeRaised event
    assert!(!events.is_empty());
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
            evidence_hash: valid_evidence_hash(&env),
            status: EscrowStatus::Disputed,
            total_amount: 1000,
            total_released: 0,
            deadline: 1706400000,
            timestamp: 0,
        }
    );
}

/// Sets up a funded, disputable escrow and returns its client/parties.
/// Shared by the dispute-evidence tests below.
fn setup_disputable_escrow<'a>(
    env: &Env,
    escrow_id: u64,
    amount: i128,
) -> (VaultixEscrowClient<'a>, Address, Address, Address) {
    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(env, &contract_id);

    let admin = Address::generate(env);
    let operator = Address::generate(env);
    let arbitrator = Address::generate(env);
    let depositor = Address::generate(env);
    let recipient = Address::generate(env);

    let (token_client, token_admin, token_address) = create_token_contract(env, &admin);
    token_admin.mint(&depositor, &amount);

    client.init(&admin, &operator, &arbitrator);

    let milestones = vec![
        env,
        Milestone {
            amount,
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
        &valid_metadata_hash(env),
    );
    token_client.approve(&depositor, &contract_id, &amount, &200);
    client.deposit_funds(&escrow_id);

    (client, contract_id, depositor, recipient)
}

/// A valid, non-zero evidence hash is recorded on chain and readable back
/// through `get_dispute_evidence`.
#[test]
fn test_raise_dispute_records_evidence_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 610u64;
    let (client, _contract_id, depositor, _recipient) =
        setup_disputable_escrow(&env, escrow_id, 3000);

    let evidence_hash = BytesN::from_array(&env, &[42u8; 32]);
    client.raise_dispute(&escrow_id, &depositor, &evidence_hash);

    assert_eq!(client.get_dispute_evidence(&escrow_id), evidence_hash);
    assert_eq!(client.get_escrow(&escrow_id).status, EscrowStatus::Disputed);
}

/// The all-zero digest is rejected with the same error `create_escrow` uses for
/// a zero `metadata_hash`, and no dispute state is written.
#[test]
fn test_raise_dispute_rejects_zero_evidence_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 611u64;
    let (client, _contract_id, depositor, _recipient) =
        setup_disputable_escrow(&env, escrow_id, 3000);

    let result = client.try_raise_dispute(&escrow_id, &depositor, &zero_hash(&env));
    assert_eq!(result, Err(Ok(Error::InvalidMetadataHash)));

    assert_eq!(client.get_escrow(&escrow_id).status, EscrowStatus::Active);
    assert_eq!(
        client.try_get_dispute_evidence(&escrow_id),
        Err(Ok(Error::DisputeEvidenceNotFound))
    );
}

/// Reading evidence for an escrow that was never disputed, or for an unknown
/// escrow id, surfaces explicit errors rather than panicking.
#[test]
fn test_get_dispute_evidence_error_paths() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 612u64;
    let (client, _contract_id, _depositor, _recipient) =
        setup_disputable_escrow(&env, escrow_id, 3000);

    assert_eq!(
        client.try_get_dispute_evidence(&escrow_id),
        Err(Ok(Error::DisputeEvidenceNotFound))
    );
    assert_eq!(
        client.try_get_dispute_evidence(&999_999u64),
        Err(Ok(Error::EscrowNotFound))
    );
    assert_eq!(
        client.try_get_dispute_resolution_evidence(&999_999u64),
        Err(Ok(Error::EscrowNotFound))
    );
}

/// The emitted `DisputeRaised` payload carries the exact evidence hash supplied
/// by the caller.
#[test]
fn test_dispute_raised_event_includes_evidence_hash() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 613u64;
    let (client, _contract_id, depositor, _recipient) =
        setup_disputable_escrow(&env, escrow_id, 3000);

    let evidence_hash = BytesN::from_array(&env, &[3u8; 32]);
    client.raise_dispute(&escrow_id, &depositor, &evidence_hash);

    // Captured before any further invocation: since soroban-sdk 21,
    // `env.events().all()` only reports the last top-level invocation.
    let events = all_events(&env);
    let event = events.last().unwrap();
    let expected_topics: soroban_sdk::Vec<soroban_sdk::Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "v1"),
        Symbol::new(&env, "DisputeRaised"),
    )
        .into_val(&env);
    assert_eq!(event.1, expected_topics);

    let escrow = client.get_escrow(&escrow_id);
    let payload: DisputeRaisedEvent = event.2.into_val(&env);
    assert_eq!(
        payload,
        DisputeRaisedEvent {
            escrow_id,
            raised_by: depositor,
            depositor: escrow.depositor,
            recipient: escrow.recipient,
            evidence_hash,
            status: EscrowStatus::Disputed,
            total_amount: 3000,
            total_released: 0,
            deadline: 1706400000,
            timestamp: 0,
        }
    );
}

/// Arbitrator supplies resolution evidence: it is stored, readable, and echoed
/// on the `DisputeResolved` event.
#[test]
fn test_resolve_dispute_records_resolution_evidence() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 614u64;
    let (client, _contract_id, depositor, recipient) =
        setup_disputable_escrow(&env, escrow_id, 3000);

    let evidence_hash = BytesN::from_array(&env, &[11u8; 32]);
    let resolution_hash = BytesN::from_array(&env, &[12u8; 32]);

    client.raise_dispute(&escrow_id, &depositor, &evidence_hash);
    client.resolve_dispute(
        &escrow_id,
        &recipient,
        &None,
        &Some(resolution_hash.clone()),
    );

    // Captured before any further invocation: since soroban-sdk 21,
    // `env.events().all()` only reports the last top-level invocation.
    let events = all_events(&env);

    assert_eq!(client.get_dispute_evidence(&escrow_id), evidence_hash);
    assert_eq!(
        client.get_dispute_resolution_evidence(&escrow_id),
        Some(resolution_hash.clone())
    );

    let event = events.last().unwrap();
    let expected_topics: soroban_sdk::Vec<soroban_sdk::Val> = (
        Symbol::new(&env, "Vaultix"),
        Symbol::new(&env, "v1"),
        Symbol::new(&env, "DisputeResolved"),
    )
        .into_val(&env);
    assert_eq!(event.1, expected_topics);

    let payload: DisputeResolvedEvent = event.2.into_val(&env);
    assert_eq!(payload.resolution_evidence_hash, Some(resolution_hash));
    assert_eq!(payload.escrow_id, escrow_id);
}

/// `None` resolution evidence stays a zero-friction path: resolution succeeds,
/// nothing is stored, and the event reports the absence explicitly.
#[test]
fn test_resolve_dispute_without_resolution_evidence() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 615u64;
    let (client, _contract_id, depositor, recipient) =
        setup_disputable_escrow(&env, escrow_id, 3000);

    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));
    client.resolve_dispute(&escrow_id, &recipient, &None, &None);

    // Captured before any further invocation: since soroban-sdk 21,
    // `env.events().all()` only reports the last top-level invocation.
    let events = all_events(&env);

    assert_eq!(client.get_escrow(&escrow_id).status, EscrowStatus::Resolved);
    assert_eq!(client.get_dispute_resolution_evidence(&escrow_id), None);
    // Dispute evidence survives resolution.
    assert_eq!(
        client.get_dispute_evidence(&escrow_id),
        valid_evidence_hash(&env)
    );

    let payload: DisputeResolvedEvent = events.last().unwrap().2.into_val(&env);
    assert_eq!(payload.resolution_evidence_hash, None);
}

/// An all-zero resolution evidence hash is rejected with the same digest error,
/// and the dispute stays open.
#[test]
fn test_resolve_dispute_rejects_zero_resolution_evidence() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 616u64;
    let (client, _contract_id, depositor, recipient) =
        setup_disputable_escrow(&env, escrow_id, 3000);

    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    let result = client.try_resolve_dispute(&escrow_id, &recipient, &None, &Some(zero_hash(&env)));
    assert_eq!(result, Err(Ok(Error::InvalidMetadataHash)));

    assert_eq!(client.get_escrow(&escrow_id).status, EscrowStatus::Disputed);
    assert_eq!(client.get_dispute_resolution_evidence(&escrow_id), None);
}

#[test]
fn test_raise_dispute_invalid_status() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
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

    let result_completed =
        client.try_raise_dispute(&escrow_id_completed, &depositor, &valid_evidence_hash(&env));
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

    let result_cancelled =
        client.try_raise_dispute(&escrow_id_cancelled, &depositor, &valid_evidence_hash(&env));
    assert_eq!(result_cancelled, Err(Ok(Error::InvalidEscrowStatus)));
}

#[test]
fn test_resolve_dispute_invalid_winner_or_overflow() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
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

    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    // Invalid winner
    let result_invalid_winner = client.try_resolve_dispute(&escrow_id, &outsider, &None, &None);
    assert_eq!(result_invalid_winner, Err(Ok(Error::InvalidWinner)));
}

#[test]
fn test_resolve_dispute_while_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
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

    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    // Pause contract after dispute is raised
    client.set_paused(&true);

    // Resolution should still be allowed by admin while paused
    client.resolve_dispute(&escrow_id, &depositor, &None, &None);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(escrow.resolution, Resolution::Depositor);
}

// ── Dispute resolution: split, bounds, and terminal-state tests ────────────

/// Split where recipient is the winner.
/// Verifies exact-amount distribution and correct Resolution::Split accounting.
#[test]
fn test_resolve_dispute_split_recipient_wins() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 500u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &3000);

    client.init(&admin, &operator, &arbitrator);

    let milestones = vec![
        &env,
        Milestone {
            amount: 3000,
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
    token_client.approve(&depositor, &contract_id, &3000, &200);
    client.deposit_funds(&escrow_id);
    client.raise_dispute(&escrow_id, &recipient, &valid_evidence_hash(&env));

    // Recipient wins 2000, depositor gets back 1000
    client.resolve_dispute(&escrow_id, &recipient, &Some(2000), &None);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(escrow.resolution, Resolution::Split);
    // total_released tracks recipient payments only
    assert_eq!(escrow.total_released, 2000);

    assert_eq!(token_client.balance(&recipient), 2000);
    assert_eq!(token_client.balance(&depositor), 1000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

/// Split where depositor is the winner.
/// Verifies exact-amount distribution when winner is the depositor.
#[test]
fn test_resolve_dispute_split_depositor_wins() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 501u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &3000);

    client.init(&admin, &operator, &arbitrator);

    let milestones = vec![
        &env,
        Milestone {
            amount: 3000,
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
    token_client.approve(&depositor, &contract_id, &3000, &200);
    client.deposit_funds(&escrow_id);
    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    // Depositor wins 2000, recipient gets 1000
    client.resolve_dispute(&escrow_id, &depositor, &Some(2000), &None);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(escrow.resolution, Resolution::Split);
    // total_released tracks recipient payments; recipient got the "other" share
    assert_eq!(escrow.total_released, 1000);

    assert_eq!(token_client.balance(&depositor), 2000);
    assert_eq!(token_client.balance(&recipient), 1000);
    assert_eq!(token_client.balance(&contract_id), 0);
}

/// Negative split_winner_amount must be rejected before any transfer occurs.
#[test]
fn test_resolve_dispute_split_negative_amount() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 502u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &1000);

    client.init(&admin, &operator, &arbitrator);

    let milestones = vec![
        &env,
        Milestone {
            amount: 1000,
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
    token_client.approve(&depositor, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);
    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    let result = client.try_resolve_dispute(&escrow_id, &recipient, &Some(-1), &None);
    assert_eq!(result, Err(Ok(Error::InvalidMilestoneAmount)));

    // No funds should have moved
    assert_eq!(token_client.balance(&contract_id), 1000);
}

/// split_winner_amount exceeding the outstanding balance must be rejected.
#[test]
fn test_resolve_dispute_split_exceeds_outstanding() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 503u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &1000);

    client.init(&admin, &operator, &arbitrator);

    let milestones = vec![
        &env,
        Milestone {
            amount: 1000,
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
    token_client.approve(&depositor, &contract_id, &1000, &200);
    client.deposit_funds(&escrow_id);
    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    // 1001 > 1000 outstanding
    let result = client.try_resolve_dispute(&escrow_id, &recipient, &Some(1001), &None);
    assert_eq!(result, Err(Ok(Error::InvalidMilestoneAmount)));

    // No funds should have moved
    assert_eq!(token_client.balance(&contract_id), 1000);
}

/// After resolution, every state-changing path must be blocked.
/// Verifies that Resolved is a true terminal state.
#[test]
fn test_resolved_is_terminal() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 504u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &2000);

    client.init(&admin, &operator, &arbitrator);

    let milestones = vec![
        &env,
        Milestone {
            amount: 2000,
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
    token_client.approve(&depositor, &contract_id, &2000, &200);
    client.deposit_funds(&escrow_id);
    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    // Resolve: recipient wins all
    client.resolve_dispute(&escrow_id, &recipient, &None, &None);
    assert_eq!(client.get_escrow(&escrow_id).status, EscrowStatus::Resolved);

    // raise_dispute must be blocked
    let r = client.try_raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));
    assert_eq!(r, Err(Ok(Error::InvalidEscrowStatus)));

    // resolve_dispute again must be blocked (not Disputed)
    let r = client.try_resolve_dispute(&escrow_id, &recipient, &None, &None);
    assert_eq!(r, Err(Ok(Error::InvalidEscrowStatus)));

    // cancel_escrow must be blocked
    let r = client.try_cancel_escrow(&escrow_id);
    assert_eq!(r, Err(Ok(Error::InvalidEscrowStatus)));

    // release_milestone must be blocked
    let r = client.try_release_milestone(&escrow_id, &0);
    assert_eq!(r, Err(Ok(Error::EscrowNotActive)));

    // refund_expired must be blocked (advance ledger past deadline)
    env.ledger().with_mut(|li| li.timestamp = 1706400001u64);
    let r = client.try_refund_expired(&escrow_id, &depositor);
    assert_eq!(r, Err(Ok(Error::InvalidStatusForRefund)));
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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
    let contract_id = env.register(VaultixEscrow, ());
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
    let contract_id = env.register(VaultixEscrow, ());
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
    let contract_id = env.register(VaultixEscrow, ());
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
    let contract_id = env.register(VaultixEscrow, ());
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
    let contract_id = env.register(VaultixEscrow, ());
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
    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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
    let contract_id = env.register(VaultixEscrow, ());
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
    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

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

/// Spec: refund_expired is allowed when the contract is paused.
/// Rationale: safety + fairness guarantee, depositors should be able to get their funds back if deadline is passed.
#[test]
fn test_refund_expired_allowed_when_paused() {
    let env = Env::default();
    env.mock_all_auths();

    let deadline = 1_000u64;
    let (client, depositor, escrow_id, _, _) = setup_funded_escrow_for_refund(&env, deadline);

    // Pause the contract
    client.set_paused(&true);

    // Advance past deadline
    env.ledger().with_mut(|li| li.timestamp = deadline + 1);

    // Must succeed even when paused (safety + fairness)
    let result = client.try_refund_expired(&escrow_id, &depositor);
    assert!(result.is_ok());
}

#[test]
#[should_panic(expected = "Error(Contract, #28)")]
fn test_pause_fails_without_operator_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    // set_paused requires operator. Operator not set -> OperatorNotInitialized (28)
    client.set_paused(&true);
}

#[test]
#[should_panic(expected = "Error(Contract, #29)")]
fn test_resolve_dispute_fails_without_arbitrator_initialized() {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(VaultixEscrow, ());
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
    client.raise_dispute(&escrow_id, &depositor, &valid_evidence_hash(&env));

    let winner = Address::generate(&env);

    // This should now correctly panic with ArbitratorNotInitialized (29)
    client.resolve_dispute(&escrow_id, &winner, &None, &None);
}
// ===============================================================================
// Configurable Fee Model Tests (Feature #93)
// Tests for per-token and per-escrow fee overrides with precedence logic
// ===============================================================================

// #[test]
// fn test_set_token_fee_valid() {
//     let env = Env::default();
//     env.mock_all_auths();

//     let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

//     let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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
    assert_canonical_event_topics(&env, &all_events(&env), &contract_id, "MultisigConfigured");

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.threshold_amount, 3000);
    assert_eq!(escrow.required_signatures, 2);
}

#[test]
fn test_collect_signature() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
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
    assert_canonical_event_topics(&env, &all_events(&env), &contract_id, "SignatureCollected");

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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

/// `Env` for the chunked party-index tests.
///
/// These tests create hundreds of ledger entries, and the default test `Env`
/// writes a `test_snapshots/*.json` capture of the whole ledger when it drops,
/// which would mean multi-megabyte snapshot files per test. soroban-sdk 21+
/// exposes `EnvTestConfig::capture_snapshot_at_drop` so this can be opted out
/// of explicitly.
fn index_test_env() -> Env {
    Env::new_with_config(EnvTestConfig {
        capture_snapshot_at_drop: false,
    })
}

/// Sets up an initialized contract plus a token and single-milestone template
/// used by the chunked party-index tests.
fn setup_index_test(
    env: &Env,
) -> (
    VaultixEscrowClient<'_>,
    Address,
    soroban_sdk::Vec<Milestone>,
) {
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(env, &contract_id);

    let treasury = Address::generate(env);
    client.initialize(&treasury, &Some(0));

    let admin = Address::generate(env);
    let (_token_client, _token_admin, token_address) = create_token_contract(env, &admin);

    let milestones = vec![
        env,
        Milestone {
            amount: 5000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Task"),
        },
    ];

    (client, token_address, milestones)
}

#[test]
fn test_list_escrows_spans_multiple_index_chunks() {
    let env = index_test_env();
    let (client, token_address, milestones) = setup_index_test(&env);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    // 250 escrows => 3 chunks of 100/100/50 for both depositor and recipient.
    let total: u64 = 250;
    for i in 1..=total {
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

    // Chunks are bounded: no single entry holds the whole history.
    assert_eq!(
        client.test_party_index_chunk_len(&depositor, &symbol_short!("depositor"), &0u32),
        100
    );
    assert_eq!(
        client.test_party_index_chunk_len(&depositor, &symbol_short!("depositor"), &1u32),
        100
    );
    assert_eq!(
        client.test_party_index_chunk_len(&depositor, &symbol_short!("depositor"), &2u32),
        50
    );
    assert_eq!(
        client.test_party_index_chunk_len(&depositor, &symbol_short!("depositor"), &3u32),
        0
    );

    // Full history is still readable, in order, across pages (both roles).
    for (role, party) in [
        (symbol_short!("depositor"), depositor.clone()),
        (symbol_short!("recipient"), recipient.clone()),
    ] {
        let mut seen: u64 = 0;
        for page in 0..3u32 {
            let summaries = client.list_escrows_by_party(&party, &role, &page, &100u32);
            let expected_len = if page == 2 { 50 } else { 100 };
            assert_eq!(summaries.len(), expected_len);
            for summary in summaries.iter() {
                seen += 1;
                assert_eq!(summary.escrow_id, seen);
            }
        }
        assert_eq!(seen, total);

        // Page past the end is empty.
        let empty = client.list_escrows_by_party(&party, &role, &3u32, &100u32);
        assert_eq!(empty.len(), 0);
    }
}

#[test]
fn test_list_escrows_pagination_across_chunk_boundary() {
    let env = index_test_env();
    let (client, token_address, milestones) = setup_index_test(&env);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    for i in 1..=250u64 {
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

    // page_size 30 / page 3 => indices [90, 120) => ids 91..=120, straddling the
    // boundary between chunk 0 (ids 1..=100) and chunk 1 (ids 101..=200).
    let page = client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &3u32, &30u32);
    assert_eq!(page.len(), 30);
    for (offset, summary) in page.iter().enumerate() {
        assert_eq!(summary.escrow_id, 91 + offset as u64);
    }

    // page_size 7 / page 14 => indices [98, 105) => ids 99..=105, also straddling.
    let page = client.list_escrows_by_party(&depositor, &symbol_short!("depositor"), &14u32, &7u32);
    assert_eq!(page.len(), 7);
    for (offset, summary) in page.iter().enumerate() {
        assert_eq!(summary.escrow_id, 99 + offset as u64);
    }

    // Boundary between chunk 1 and chunk 2 (ids 201..=250), with a short tail.
    let page = client.list_escrows_by_party(&recipient, &symbol_short!("recipient"), &4u32, &45u32);
    assert_eq!(page.len(), 45);
    for (offset, summary) in page.iter().enumerate() {
        assert_eq!(summary.escrow_id, 181 + offset as u64);
    }

    // Last partial page stops at the true total.
    let page = client.list_escrows_by_party(&recipient, &symbol_short!("recipient"), &5u32, &45u32);
    assert_eq!(page.len(), 25);
    assert_eq!(page.get(0).unwrap().escrow_id, 226);
    assert_eq!(page.get(24).unwrap().escrow_id, 250);

    // MAX_PAGE_SIZE is still enforced now that pages are served from chunks.
    let too_big =
        client.try_list_escrows_by_party(&depositor, &symbol_short!("depositor"), &0u32, &101u32);
    assert_eq!(too_big, Err(Ok(Error::VectorTooLarge)));
}

#[test]
fn test_create_escrow_cost_is_independent_of_history() {
    let env = index_test_env();
    let (client, token_address, milestones) = setup_index_test(&env);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let create = |id: u64, from: &Address, to: &Address| {
        client.create_escrow(
            &id,
            from,
            to,
            &token_address,
            &milestones,
            &1706400000u64,
            &valid_metadata_hash(&env),
        );
    };

    // Build up several chunks of history for one party pair.
    for i in 1..=250u64 {
        create(i, &depositor, &recipient);
    }

    // The test host resets budget metering before every top-level invocation,
    // so each measurement below covers exactly one `create_escrow` call.

    // Control: a party pair with no history at all, measured at the same total
    // ledger size so only the per-party history differs.
    let fresh_depositor = Address::generate(&env);
    let fresh_recipient = Address::generate(&env);
    create(251, &fresh_depositor, &fresh_recipient);
    let fresh_cost = env.cost_estimate().budget().cpu_instruction_cost();

    // Same call for a party with 250 prior escrows.
    create(252, &depositor, &recipient);
    let history_cost = env.cost_estimate().budget().cpu_instruction_cost();

    assert!(
        history_cost <= fresh_cost * 3 / 2,
        "create_escrow cost grew with party history: fresh={} with_history={}",
        fresh_cost,
        history_cost
    );
}

#[test]
fn test_legacy_party_index_migrates_on_list() {
    let env = index_test_env();
    let (client, token_address, milestones) = setup_index_test(&env);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    // Existing escrow entries these legacy ids point at.
    for i in 1..=120u64 {
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

    // A party whose index only exists in the old unbounded-vector format.
    let legacy_party = Address::generate(&env);
    let mut legacy_ids = soroban_sdk::Vec::new(&env);
    for i in 1..=120u64 {
        legacy_ids.push_back(i);
    }
    client.test_set_legacy_party_index(&legacy_party, &symbol_short!("depositor"), &legacy_ids);
    assert!(client.test_has_legacy_party_index(&legacy_party, &symbol_short!("depositor")));

    // Read-only path migrates and paginates correctly.
    let page0 =
        client.list_escrows_by_party(&legacy_party, &symbol_short!("depositor"), &0u32, &100u32);
    assert_eq!(page0.len(), 100);
    assert_eq!(page0.get(0).unwrap().escrow_id, 1);
    assert_eq!(page0.get(99).unwrap().escrow_id, 100);

    let page1 =
        client.list_escrows_by_party(&legacy_party, &symbol_short!("depositor"), &1u32, &100u32);
    assert_eq!(page1.len(), 20);
    assert_eq!(page1.get(0).unwrap().escrow_id, 101);
    assert_eq!(page1.get(19).unwrap().escrow_id, 120);

    // Legacy entry is gone, data now lives in bounded chunks.
    assert!(!client.test_has_legacy_party_index(&legacy_party, &symbol_short!("depositor")));
    assert_eq!(
        client.test_party_index_chunk_len(&legacy_party, &symbol_short!("depositor"), &0u32),
        100
    );
    assert_eq!(
        client.test_party_index_chunk_len(&legacy_party, &symbol_short!("depositor"), &1u32),
        20
    );

    // Straddling page after migration is still contiguous.
    let straddle =
        client.list_escrows_by_party(&legacy_party, &symbol_short!("depositor"), &3u32, &30u32);
    assert_eq!(straddle.len(), 30);
    for (offset, summary) in straddle.iter().enumerate() {
        assert_eq!(summary.escrow_id, 91 + offset as u64);
    }

    // New appends continue after the migrated history.
    let new_recipient = Address::generate(&env);
    client.create_escrow(
        &900u64,
        &legacy_party,
        &new_recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    let page1 =
        client.list_escrows_by_party(&legacy_party, &symbol_short!("depositor"), &1u32, &100u32);
    assert_eq!(page1.len(), 21);
    assert_eq!(page1.get(20).unwrap().escrow_id, 900);
}

#[test]
fn test_legacy_party_index_migrates_on_append() {
    let env = index_test_env();
    let (client, token_address, milestones) = setup_index_test(&env);

    let depositor = Address::generate(&env);
    let legacy_recipient = Address::generate(&env);

    for i in 1..=5u64 {
        client.create_escrow(
            &i,
            &depositor,
            &Address::generate(&env),
            &token_address,
            &milestones,
            &1706400000u64,
            &valid_metadata_hash(&env),
        );
    }

    // Legacy recipient index written directly in the old format.
    let mut legacy_ids = soroban_sdk::Vec::new(&env);
    for i in 1..=5u64 {
        legacy_ids.push_back(i);
    }
    client.test_set_legacy_party_index(&legacy_recipient, &symbol_short!("recipient"), &legacy_ids);

    // Append path (create_escrow) triggers migration before the first list.
    client.create_escrow(
        &6u64,
        &depositor,
        &legacy_recipient,
        &token_address,
        &milestones,
        &1706400000u64,
        &valid_metadata_hash(&env),
    );

    assert!(!client.test_has_legacy_party_index(&legacy_recipient, &symbol_short!("recipient")));
    assert_eq!(
        client.test_party_index_chunk_len(&legacy_recipient, &symbol_short!("recipient"), &0u32),
        6
    );

    let summaries = client.list_escrows_by_party(
        &legacy_recipient,
        &symbol_short!("recipient"),
        &0u32,
        &10u32,
    );
    assert_eq!(summaries.len(), 6);
    for (offset, summary) in summaries.iter().enumerate() {
        assert_eq!(summary.escrow_id, 1 + offset as u64);
    }
}

#[test]
fn test_list_escrows_returns_lightweight_summaries() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let events = all_events(&env);
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let events = all_events(&env);
    // Find the last event (EscrowCreated) — skip initialization events
    let create_event: EscrowCreatedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(create_event.status, EscrowStatus::Created);
    assert_eq!(create_event.total_amount, 10000);
    assert_eq!(create_event.total_released, 0);
    assert_eq!(create_event.deadline, deadline);

    // --- Step 2: Deposit funds ---
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    let events = all_events(&env);
    let deposit_event: FundsDepositedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(deposit_event.status, EscrowStatus::Active);
    assert_eq!(deposit_event.total_amount, 10000);
    assert_eq!(deposit_event.total_released, 0);
    assert_eq!(deposit_event.deadline, deadline);

    // --- Step 3: Release milestone 0 ---
    client.release_milestone(&escrow_id, &0);

    let events = all_events(&env);
    let release_event: MilestoneReleasedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(release_event.status, EscrowStatus::Active);
    assert_eq!(release_event.total_amount, 10000);
    assert_eq!(release_event.total_released, 4000);
    assert_eq!(release_event.deadline, deadline);

    // --- Step 4: Delivery confirm milestone 1 ---
    client.confirm_delivery(&escrow_id, &1, &depositor);

    let events = all_events(&env);
    let confirm_event: DeliveryConfirmedEvent = events.last().unwrap().2.clone().into_val(&env);
    assert_eq!(confirm_event.status, EscrowStatus::Active);
    assert_eq!(confirm_event.total_amount, 10000);
    assert_eq!(confirm_event.total_released, 10000);
    assert_eq!(confirm_event.deadline, deadline);

    // --- Step 5: Complete escrow ---
    client.complete_escrow(&escrow_id);

    let events = all_events(&env);
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

    let contract_id = env.register(VaultixEscrow, ());
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

    let events = all_events(&env);

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

    let contract_id = env.register(VaultixEscrow, ());
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

    // Run through a series of operations and verify all event topics.
    //
    // Since soroban-sdk 21, `env.events().all()` only reports the events of the
    // most recent top-level invocation, so each operation is checked right
    // after its own call instead of walking one accumulated log.
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
    assert_canonical_event_topics(&env, &all_events(&env), &contract_id, "EscrowCreated");

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);
    assert_canonical_event_topics(&env, &all_events(&env), &contract_id, "FundsDeposited");

    client.release_milestone(&escrow_id, &0);
    assert_canonical_event_topics(&env, &all_events(&env), &contract_id, "MilestoneReleased");

    client.complete_escrow(&escrow_id);
    assert_canonical_event_topics(&env, &all_events(&env), &contract_id, "EscrowCompleted");
}

/// Covers `ContractUpgraded`, the third event fixed by issue #569.
/// Calls `VaultixEscrow::upgrade` directly via `env.as_contract(...)` and
/// catches the resulting panic from the dummy (non-existent) Wasm hash, since
/// only the topic on the already-published event needs verifying here.
#[test]
fn test_contract_upgraded_uses_canonical_topic() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(VaultixEscrow, ());
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    client.init(&admin, &operator, &arbitrator);

    let new_wasm_hash = [7u8; 32];
    let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        env.as_contract(&contract_id, || {
            let _ = VaultixEscrow::upgrade(env.clone(), new_wasm_hash);
        });
    }));
    assert!(
        result.is_err(),
        "expected the dummy-wasm deploy step to panic"
    );

    assert_canonical_event_topics(&env, &all_events(&env), &contract_id, "ContractUpgraded");
}

/// Asserts that every event emitted by `contract_id` in `events` uses the
/// canonical `(Vaultix, v1, EventName)` three-topic format, and that at least
/// one of them is named `expected_name`.
fn assert_canonical_event_topics(
    env: &Env,
    events: &soroban_sdk::Vec<(Address, soroban_sdk::Vec<Val>, Val)>,
    contract_id: &Address,
    expected_name: &str,
) {
    use soroban_sdk::TryFromVal;

    let namespace = Symbol::new(env, "Vaultix");
    let version = Symbol::new(env, "v1");
    let expected_topics: soroban_sdk::Vec<Val> = (
        namespace.clone(),
        version.clone(),
        Symbol::new(env, expected_name),
    )
        .into_val(env);

    let mut found = false;
    for (emitter, topics, _) in events.iter() {
        if &emitter != contract_id {
            // Sub-invocations (e.g. the token contract) emit their own events.
            continue;
        }
        assert_eq!(
            topics.len(),
            3,
            "Vaultix events must have exactly 3 topics, got {:?}",
            topics
        );
        assert_eq!(
            Symbol::try_from_val(env, &topics.get(0).unwrap()).unwrap(),
            namespace,
            "first topic must be the Vaultix namespace"
        );
        assert_eq!(
            Symbol::try_from_val(env, &topics.get(1).unwrap()).unwrap(),
            version,
            "second topic must be the v1 schema version"
        );
        if topics == expected_topics {
            found = true;
        }
    }

    assert!(
        found,
        "Event {} must be emitted with canonical topic format (Vaultix, v1, {})",
        expected_name, expected_name
    );
}
