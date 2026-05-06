#![cfg(test)]
extern crate std;

use soroban_sdk::{
    testutils::Address as _,
    Address, BytesN, Env,
};
use soroban_sdk::token;

use crate::{
    VaultixEscrow, VaultixEscrowClient,
    types::{Error, EscrowStatus, MilestoneStatus},
};

use crate::fee_tests::create_token_contract;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Events, Ledger},
    token, vec, Address, Env, IntoVal,
};

/// Helper: sets up a funded escrow with a configurable multisig threshold.
/// Returns (client, contract_id, depositor, recipient, token_client, escrow_id).
fn setup_multisig_escrow<'a>(
    env: &Env,
    escrow_id: u64,
    milestone_amount: i128,
    threshold: i128,
    required_sigs: u32,
) -> (
    VaultixEscrowClient<'a>,
    Address,
    Address,
    Address,
    token::Client<'a>,
) {
    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(env, &contract_id);

    let treasury = Address::generate(env);
    client.initialize(&treasury, &Some(0)); // zero fee for simplicity

    let admin = Address::generate(env);
    let operator = Address::generate(env);
    let arbitrator = Address::generate(env);
    client.init(&admin, &operator, &arbitrator);

    let depositor = Address::generate(env);
    let recipient = Address::generate(env);

    let (token_client, token_admin, token_address) = create_token_contract(env, &admin);
    token_admin.mint(&depositor, &(milestone_amount * 2));

    let milestones = vec![
        env,
        Milestone {
            amount: milestone_amount,
            status: MilestoneStatus::Pending,
            description: symbol_short!("M1"),
        },
        Milestone {
            amount: milestone_amount,
            status: MilestoneStatus::Pending,
            description: symbol_short!("M2"),
        },
    ];

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &1_900_000_000u64,
        &BytesN::from_array(env, &[0u8; 32]),
    );
    client.configure_multisig(&escrow_id, &threshold, &required_sigs);
    token_client.approve(&depositor, &contract_id, &(milestone_amount * 2), &200);
    client.deposit_funds(&escrow_id);

    (client, contract_id, depositor, recipient, token_client)
}

// ---------------------------------------------------------------------------
// Duplicate signer rejection
// ---------------------------------------------------------------------------

#[test]
fn test_duplicate_signer_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 500u64;
    let (client, _contract_id, depositor, _recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 2);

    // First collect succeeds
    client.collect_signature(&escrow_id, &depositor);

    // Second collect by the same signer must fail with DuplicateSignature (30)
    let result = client.try_collect_signature(&escrow_id, &depositor);
    assert_eq!(result, Err(Ok(Error::DuplicateSignature)));

    // Signature count must still be 1
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.collected_signatures.len(), 1);
}

#[test]
fn test_two_distinct_signers_both_accepted() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 501u64;
    let (client, _contract_id, depositor, recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 2);

    client.collect_signature(&escrow_id, &depositor);
    client.collect_signature(&escrow_id, &recipient);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.collected_signatures.len(), 2);
}

// ---------------------------------------------------------------------------
// Signature reset after milestone release (replay prevention)
// ---------------------------------------------------------------------------

#[test]
fn test_signatures_cleared_after_release_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 502u64;
    let (client, _contract_id, depositor, recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 2);

    // Collect enough signatures and release milestone 0
    client.collect_signature(&escrow_id, &depositor);
    client.collect_signature(&escrow_id, &recipient);
    client.release_milestone(&escrow_id, &0);

    // Signatures must be cleared — cannot be replayed for milestone 1
    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(
        escrow.collected_signatures.len(),
        0,
        "Signatures must be cleared after release to prevent replay"
    );
}

#[test]
fn test_released_signatures_cannot_authorize_next_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 503u64;
    let (client, _contract_id, depositor, recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 2);

    // Collect and release milestone 0
    client.collect_signature(&escrow_id, &depositor);
    client.collect_signature(&escrow_id, &recipient);
    client.release_milestone(&escrow_id, &0);

    // Attempt to release milestone 1 without fresh signatures — must fail
    let result = client.try_release_milestone(&escrow_id, &1);
    assert_eq!(
        result,
        Err(Ok(Error::UnauthorizedAccess)),
        "Stale signatures from a previous window must not authorise the next milestone"
    );
}

#[test]
fn test_fresh_signatures_required_for_second_milestone() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 504u64;
    let third_party = Address::generate(&env);
    let (client, _contract_id, depositor, recipient, token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 2);

    // Release milestone 0
    client.collect_signature(&escrow_id, &depositor);
    client.collect_signature(&escrow_id, &recipient);
    client.release_milestone(&escrow_id, &0);

    // Collect fresh signatures for milestone 1
    client.collect_signature(&escrow_id, &depositor);
    client.collect_signature(&escrow_id, &third_party);
    client.release_milestone(&escrow_id, &1);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(
        escrow.milestones.get(1).unwrap().status,
        MilestoneStatus::Released
    );
    // Signatures cleared again after second release
    assert_eq!(escrow.collected_signatures.len(), 0);

    // Recipient received both milestone payouts (zero fee)
    assert_eq!(token_client.balance(&recipient), 10_000);
}

// ---------------------------------------------------------------------------
// Signature reset on dispute
// ---------------------------------------------------------------------------

#[test]
fn test_signatures_cleared_on_dispute() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 505u64;
    let (client, _contract_id, depositor, _recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 2);

    client.collect_signature(&escrow_id, &depositor);

    // Raise dispute — signatures must be cleared
    client.raise_dispute(&escrow_id, &depositor);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(
        escrow.collected_signatures.len(),
        0,
        "Signatures must be cleared when a dispute is raised"
    );
}

// ---------------------------------------------------------------------------
// Signature reset on cancel / refund
// ---------------------------------------------------------------------------

#[test]
fn test_signatures_cleared_on_cancel() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 506u64;
    let (client, _contract_id, depositor, _recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 2);

    client.collect_signature(&escrow_id, &depositor);
    client.cancel_escrow(&escrow_id);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(
        escrow.collected_signatures.len(),
        0,
        "Signatures must be cleared on cancellation"
    );
    assert_eq!(escrow.status, EscrowStatus::Cancelled);
}

#[test]
fn test_signatures_cleared_on_refund_expired() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    client.init(&admin, &operator, &arbitrator);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let escrow_id = 507u64;

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    let deadline = 1_000u64;
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
        &deadline,
        &BytesN::from_array(&env, &[0u8; 32]),
    );
    client.configure_multisig(&escrow_id, &5_000, &2);
    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Collect a signature before expiry
    client.collect_signature(&escrow_id, &depositor);

    // Fast-forward past deadline
    env.ledger().with_mut(|l| l.timestamp = 2_000);

    client.refund_expired(&escrow_id, &depositor);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(
        escrow.collected_signatures.len(),
        0,
        "Signatures must be cleared on expiry refund"
    );
    assert_eq!(escrow.status, EscrowStatus::Expired);
}

// ---------------------------------------------------------------------------
// required_signatures bounds validation
// ---------------------------------------------------------------------------

#[test]
fn test_configure_multisig_zero_required_sigs_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 508u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &5_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5_000,
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
        &1_900_000_000u64,
        &BytesN::from_array(&env, &[0u8; 32]),
    );

    // required_signatures = 0 must be rejected
    let result = client.try_configure_multisig(&escrow_id, &3_000, &0);
    assert_eq!(result, Err(Ok(Error::InvalidSignatureConfig)));
}

#[test]
fn test_configure_multisig_exceeds_max_rejected() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 509u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &5_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5_000,
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
        &1_900_000_000u64,
        &BytesN::from_array(&env, &[0u8; 32]),
    );

    // required_signatures = 11 exceeds MAX_REQUIRED_SIGNATURES (10)
    let result = client.try_configure_multisig(&escrow_id, &3_000, &11);
    assert_eq!(result, Err(Ok(Error::InvalidSignatureConfig)));
}

#[test]
fn test_configure_multisig_max_boundary_accepted() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(0));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);
    let escrow_id = 510u64;

    let (_token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &5_000);

    let milestones = vec![
        &env,
        Milestone {
            amount: 5_000,
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
        &1_900_000_000u64,
        &BytesN::from_array(&env, &[0u8; 32]),
    );

    // required_signatures = 10 (MAX_REQUIRED_SIGNATURES) must be accepted
    let result = client.try_configure_multisig(&escrow_id, &3_000, &10);
    assert!(
        result.is_ok(),
        "MAX_REQUIRED_SIGNATURES boundary should be valid"
    );

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.required_signatures, 10);
}

// ---------------------------------------------------------------------------
// confirm_delivery signature reset
// ---------------------------------------------------------------------------

#[test]
fn test_signatures_cleared_after_confirm_delivery() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 511u64;
    let (client, _contract_id, depositor, recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 2);

    client.collect_signature(&escrow_id, &depositor);
    client.collect_signature(&escrow_id, &recipient);

    // confirm_delivery is the buyer-side release path
    client.confirm_delivery(&escrow_id, &0, &depositor);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(
        escrow.collected_signatures.len(),
        0,
        "Signatures must be cleared after confirm_delivery"
    );
}

// ---------------------------------------------------------------------------
// Partial-signature threshold scenarios
// ---------------------------------------------------------------------------

#[test]
fn test_partial_signatures_below_threshold_release_blocked() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 512u64;
    let (client, _contract_id, depositor, _recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 3);

    // Only 1 of 3 required signatures
    client.collect_signature(&escrow_id, &depositor);

    let result = client.try_release_milestone(&escrow_id, &0);
    assert_eq!(result, Err(Ok(Error::UnauthorizedAccess)));
}

#[test]
fn test_exact_threshold_signatures_release_succeeds() {
    let env = Env::default();
    env.mock_all_auths();

    let escrow_id = 513u64;
    let signer_b = Address::generate(&env);
    let signer_c = Address::generate(&env);
    let (client, _contract_id, depositor, _recipient, _token_client) =
        setup_multisig_escrow(&env, escrow_id, 5_000, 3_000, 3);

    client.collect_signature(&escrow_id, &depositor);
    client.collect_signature(&escrow_id, &signer_b);
    client.collect_signature(&escrow_id, &signer_c);

    // Exactly 3 of 3 — must succeed
    let result = client.try_release_milestone(&escrow_id, &0);
    assert!(result.is_ok(), "Exact threshold should allow release");
}
