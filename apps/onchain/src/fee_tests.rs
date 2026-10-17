use crate::{Error, Milestone, MilestoneStatus, VaultixEscrow, VaultixEscrowClient};
use soroban_sdk::{symbol_short, BytesN};

/// Comprehensive tests for the Configurable Fee Model feature (#93)
/// Tests cover:
/// - Default global fee behavior (no overrides)
/// - Token-level override only
/// - Escrow-level override only
/// - Combined scenarios ensuring precedence
/// - Invalid fee (out of range) rejections
/// - Fee precedence: escrow > token > global
/// - Fee rounding edge cases for Issue #305
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, vec, Address, Env,
};

/// Helper function to create and initialize a test token
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

fn create_test_contract<'a>(
    env: &Env,
    admin: &Address,
    treasury: &Address,
    fee_bps: Option<i128>,
) -> (VaultixEscrowClient<'a>, Address) {
    let operator = Address::generate(env);
    let arbitrator = Address::generate(env);
    let contract_id = env.register(
        VaultixEscrow,
        (admin, &operator, &arbitrator, treasury, fee_bps),
    );
    let client = VaultixEscrowClient::new(env, &contract_id);
    (client, contract_id)
}

fn valid_metadata_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[7u8; 32])
}

#[test]
fn test_set_token_fee_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, _contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    // Set token fee to 100 bps (1%)
    let result = client.try_set_token_fee(&token_address, &100);
    assert!(result.is_ok());
}

#[test]
fn test_set_token_fee_invalid_fee_too_high() {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, _contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    // Try to set token fee above BPS_DENOMINATOR (10000)
    let result = client.try_set_token_fee(&token_address, &10001);
    assert_eq!(result, Err(Ok(Error::InvalidFeeConfiguration)));
}

#[test]
fn test_set_escrow_fee_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, _contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let escrow_id = 1u64;

    // Set escrow-specific fee to 75 bps (0.75%)
    let result = client.try_set_escrow_fee(&escrow_id, &75);
    assert!(result.is_ok());
}

#[test]
fn test_set_escrow_fee_invalid_fee_too_high() {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, _contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let escrow_id = 1u64;

    // Try to set escrow fee above BPS_DENOMINATOR
    let result = client.try_set_escrow_fee(&escrow_id, &10001);
    assert_eq!(result, Err(Ok(Error::InvalidFeeConfiguration)));
}

#[test]
fn test_release_milestone_uses_global_fee_by_default() {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(100)); // 1% fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

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

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50)); // 0.5% global fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

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

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50)); // 0.5% global fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

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
fn test_fee_precedence_escrow_over_token_and_global() {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50)); // 0.5% global

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    // Set token fee to 100 bps
    client.set_token_fee(&token_address, &100);

    let escrow_id = 1u64;
    // Set escrow fee to 250 bps (should override token and global)
    client.set_escrow_fee(&escrow_id, &250);

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

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);
    client.release_milestone(&escrow_id, &0);

    // Escrow fee (250 bps) should be used: 10_000 * 250 / 10_000 = 250
    let expected_fee = 250i128;
    let expected_payout = 10_000i128 - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

#[test]
fn test_cancel_escrow_uses_token_fee_override() {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50)); // 0.5% global fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

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

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50)); // 0.5% global fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
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

    let deadline = env.ledger().timestamp() + 100;
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

    // Move time forward to expire the escrow
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

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    token_admin.mint(&depositor, &10_000);

    // Set token fee to zero
    client.set_token_fee(&token_address, &0);

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
    client.release_milestone(&escrow_id, &0);

    // With zero fee, recipient gets full amount
    assert_eq!(token_client.balance(&recipient), 10_000i128);
    assert_eq!(token_client.balance(&treasury), 0i128);
}

#[test]
fn test_max_fee_10000_bps_valid() {
    let env = Env::default();
    env.mock_all_auths();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, _contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let (_token_client, _token_admin, token_address) = create_token_contract(&env, &admin);

    // Set token fee to maximum valid value (BPS_DENOMINATOR = 10000)
    let result = client.try_set_token_fee(&token_address, &10000);
    assert!(result.is_ok());
}

#[test]
fn test_fee_rounding_tiny_amount_one_bps() {
    let amount: i128 = 1;
    let fee_bps: i128 = 1;

    let fee = amount * fee_bps / 10000;
    let payout = amount - fee;

    assert_eq!(fee, 0);
    assert_eq!(payout, 1);
    assert!(payout >= 0);
}

#[test]
fn test_fee_rounding_tiny_amount_max_bps() {
    let amount: i128 = 1;
    let fee_bps: i128 = 10000;

    let fee = amount * fee_bps / 10000;
    let payout = amount - fee;

    assert_eq!(fee, 1);
    assert_eq!(payout, 0);
    assert!(payout >= 0);
}

#[test]
fn test_fee_rounding_down_for_fractional_fee() {
    let amount: i128 = 333;
    let fee_bps: i128 = 100;

    let fee = amount * fee_bps / 10000;
    let payout = amount - fee;

    assert_eq!(fee, 3);
    assert_eq!(payout, 330);
    assert!(payout >= 0);
}

#[test]
fn test_fee_never_exceeds_amount_at_edge_bps() {
    let amount: i128 = 9999;
    let fee_bps: i128 = 9999;

    let fee = amount * fee_bps / 10000;
    let payout = amount - fee;

    assert!(fee <= amount);
    assert!(payout >= 0);
}

// --- Issue #735: resolve_dispute charges the platform fee ---

/// Creates and funds escrow 1 with a single milestone of `amount`, raises a
/// dispute, and returns (client, token, treasury, depositor, recipient).
fn setup_disputed_escrow<'a>(
    env: &Env,
    global_fee_bps: i128,
    amount: i128,
    token_fee_bps: Option<i128>,
    escrow_fee_bps: Option<i128>,
) -> (
    VaultixEscrowClient<'a>,
    token::Client<'a>,
    Address,
    Address,
    Address,
) {
    env.mock_all_auths();
    let treasury = Address::generate(env);
    let admin = Address::generate(env);
    let (client, contract_id) = create_test_contract(env, &admin, &treasury, Some(global_fee_bps));

    let depositor = Address::generate(env);
    let recipient = Address::generate(env);
    let (token_client, token_admin, token_address) = create_token_contract(env, &admin);
    token_admin.mint(&depositor, &amount);

    if let Some(bps) = token_fee_bps {
        client.set_token_fee(&token_address, &bps);
    }

    client.create_escrow(
        &1u64,
        &depositor,
        &recipient,
        &token_address,
        &vec![
            env,
            Milestone {
                amount,
                status: MilestoneStatus::Pending,
                description: symbol_short!("Work"),
            },
        ],
        &(env.ledger().timestamp() + 3600),
        &valid_metadata_hash(env),
    );
    if let Some(bps) = escrow_fee_bps {
        client.set_escrow_fee(&1u64, &bps);
    }
    token_client.approve(&depositor, &contract_id, &amount, &200);
    client.deposit_funds(&1u64);
    client.raise_dispute(&1u64, &depositor, &BytesN::from_array(env, &[5u8; 32]));

    (client, token_client, treasury, depositor, recipient)
}

#[test]
fn test_resolve_dispute_full_recipient_charges_fee() {
    let env = Env::default();
    let (client, token, treasury, depositor, recipient) =
        setup_disputed_escrow(&env, 100, 10_000, None, None); // 1%
    client.resolve_dispute(&1u64, &recipient, &None, &None);

    assert_eq!(token.balance(&treasury), 100);
    assert_eq!(token.balance(&recipient), 9_900);
    assert_eq!(token.balance(&depositor), 0);
}

#[test]
fn test_resolve_dispute_full_depositor_charges_fee() {
    let env = Env::default();
    let (client, token, treasury, depositor, recipient) =
        setup_disputed_escrow(&env, 100, 10_000, None, None);
    client.resolve_dispute(&1u64, &depositor, &None, &None);

    assert_eq!(token.balance(&treasury), 100);
    assert_eq!(token.balance(&depositor), 9_900);
    assert_eq!(token.balance(&recipient), 0);
}

#[test]
fn test_resolve_dispute_split_charges_fee_on_total_outstanding() {
    // Rounding case: fee(999) = 4 at 50 bps; winner bears fee(666) = 3, the
    // other share bears the remaining 1 — total equals a single-shot fee.
    let env = Env::default();
    let (client, token, treasury, depositor, recipient) =
        setup_disputed_escrow(&env, 50, 999, None, None);
    client.resolve_dispute(&1u64, &recipient, &Some(666), &None);

    assert_eq!(token.balance(&treasury), 4);
    assert_eq!(token.balance(&recipient), 663);
    assert_eq!(token.balance(&depositor), 332);
    assert_eq!(
        token.balance(&treasury) + token.balance(&recipient) + token.balance(&depositor),
        999
    );
}

#[test]
fn test_resolve_dispute_fee_precedence_escrow_over_token_over_global() {
    // Token override (200 bps) beats global (50 bps).
    let env = Env::default();
    let (client, token, treasury, _depositor, recipient) =
        setup_disputed_escrow(&env, 50, 10_000, Some(200), None);
    client.resolve_dispute(&1u64, &recipient, &None, &None);
    assert_eq!(token.balance(&treasury), 200);
    assert_eq!(token.balance(&recipient), 9_800);

    // Escrow override (300 bps) beats token (200 bps) and global (50 bps).
    let env = Env::default();
    let (client, token, treasury, _depositor, recipient) =
        setup_disputed_escrow(&env, 50, 10_000, Some(200), Some(300));
    client.resolve_dispute(&1u64, &recipient, &None, &None);
    assert_eq!(token.balance(&treasury), 300);
    assert_eq!(token.balance(&recipient), 9_700);
}

#[test]
fn test_resolve_dispute_zero_fee_pays_out_in_full() {
    let env = Env::default();
    let (client, token, treasury, _depositor, recipient) =
        setup_disputed_escrow(&env, 0, 10_000, None, None);
    client.resolve_dispute(&1u64, &recipient, &None, &None);

    assert_eq!(token.balance(&treasury), 0);
    assert_eq!(token.balance(&recipient), 10_000);
}

// Issue #728: with a fee configured, a re-entrant token cannot make the
// contract pay the recipient or the treasury twice for one release.
#[test]
fn test_reentrant_token_release_collects_fee_once() {
    use crate::invariant_tests::reentrant_token::{self, ReentrantToken, ReentrantTokenClient};

    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let treasury = Address::generate(&env);
    let admin = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(100)); // 1%

    let token_id = env.register(ReentrantToken, ());
    let token = ReentrantTokenClient::new(&env, &token_id);
    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    token.mint(&depositor, &20_000);

    for escrow_id in [1u64, 2u64] {
        client.create_escrow(
            &escrow_id,
            &depositor,
            &recipient,
            &token_id,
            &vec![
                &env,
                Milestone {
                    amount: 10_000,
                    status: MilestoneStatus::Pending,
                    description: symbol_short!("Work"),
                },
            ],
            &(env.ledger().timestamp() + 3600),
            &valid_metadata_hash(&env),
        );
        client.deposit_funds(&escrow_id);
    }

    token.arm(
        &contract_id,
        &reentrant_token::ATTACK_RELEASE,
        &1u64,
        &depositor,
    );
    client.release_milestone(&1u64, &0);

    assert_ne!(token.outcome(), reentrant_token::OUTCOME_SUCCEEDED);
    assert_eq!(token.balance(&recipient), 9_900);
    assert_eq!(token.balance(&treasury), 100);
    assert_eq!(token.balance(&contract_id), 10_000);
    assert_eq!(client.get_escrow(&1u64).total_released, 10_000);
}

// --- Issue #737: fee basis is the escrow total, not each milestone ---
//
// Documented tolerance: at a constant fee_bps, the total fee collected over any
// sequence of releases / cancel / refund equals calculate_fee(total_amount)
// exactly (tolerance 0), however the total is split into milestones.

/// Creates and funds an escrow with the given milestone amounts.
fn setup_funded_escrow<'a>(
    env: &Env,
    fee_bps: i128,
    amounts: &[i128],
) -> (
    VaultixEscrowClient<'a>,
    token::Client<'a>,
    Address,
    Address,
    Address,
) {
    let treasury = Address::generate(env);
    let admin = Address::generate(env);
    let (client, contract_id) = create_test_contract(env, &admin, &treasury, Some(fee_bps));

    let depositor = Address::generate(env);
    let recipient = Address::generate(env);
    let (token_client, token_admin, token_address) = create_token_contract(env, &admin);

    let total: i128 = amounts.iter().sum();
    token_admin.mint(&depositor, &total);

    let mut milestones = soroban_sdk::Vec::new(env);
    for amount in amounts {
        milestones.push_back(Milestone {
            amount: *amount,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Work"),
        });
    }

    client.create_escrow(
        &1u64,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &(env.ledger().timestamp() + 3600),
        &valid_metadata_hash(env),
    );
    token_client.approve(&depositor, &contract_id, &total, &200);
    client.deposit_funds(&1u64);

    (client, token_client, treasury, depositor, recipient)
}

fn legacy_per_milestone_fee(amounts: &[i128], fee_bps: i128) -> i128 {
    amounts.iter().map(|a| a * fee_bps / 10_000).sum()
}

#[test]
fn test_split_milestone_releases_collect_same_fee_as_single_shot_cancel() {
    // Issue example: 3 x 333 at DEFAULT_FEE_BPS (50) vs one-shot on 999.
    let fee_bps = 50i128;
    let amounts = [333i128, 333, 333];
    let total: i128 = amounts.iter().sum();
    let single_shot_fee = total * fee_bps / 10_000; // 4

    let env = Env::default();
    env.mock_all_auths();
    let (client, token_client, treasury, _, recipient) =
        setup_funded_escrow(&env, fee_bps, &amounts);
    for i in 0..amounts.len() as u32 {
        client.release_milestone(&1u64, &i);
    }
    let released_fee = token_client.balance(&treasury);

    let env2 = Env::default();
    env2.mock_all_auths();
    let (client2, token_client2, treasury2, depositor2, _) =
        setup_funded_escrow(&env2, fee_bps, &[total]);
    client2.cancel_escrow(&1u64);
    let cancelled_fee = token_client2.balance(&treasury2);

    assert_eq!(single_shot_fee, 4);
    assert_eq!(released_fee, single_shot_fee);
    assert_eq!(cancelled_fee, single_shot_fee);
    assert_eq!(token_client.balance(&recipient), total - single_shot_fee);
    assert_eq!(token_client2.balance(&depositor2), total - single_shot_fee);
}

#[test]
fn test_partial_release_then_refund_expired_collects_single_shot_fee() {
    let fee_bps = 50i128;
    let amounts = [333i128, 333, 333];
    let total: i128 = amounts.iter().sum();

    let env = Env::default();
    env.mock_all_auths();
    let (client, token_client, treasury, depositor, recipient) =
        setup_funded_escrow(&env, fee_bps, &amounts);

    client.release_milestone(&1u64, &0);
    env.ledger().with_mut(|l| l.timestamp += 3601);
    client.refund_expired(&1u64, &depositor);

    let fee = token_client.balance(&treasury);
    assert_eq!(fee, total * fee_bps / 10_000);
    assert_eq!(
        token_client.balance(&recipient) + token_client.balance(&depositor) + fee,
        total
    );
}

#[test]
fn test_many_small_milestones_no_longer_under_collect_fee() {
    // Worst case for per-milestone floor rounding: each milestone's fee is just
    // under 1 unit, so the legacy scheme collected 0 while the aggregate is 9.
    let fee_bps = 50i128;
    let amounts = [199i128; 10];
    let total: i128 = amounts.iter().sum();
    let single_shot_fee = total * fee_bps / 10_000;

    // Shortfall under the old per-milestone basis (bounded by N - 1 units).
    assert_eq!(legacy_per_milestone_fee(&amounts, fee_bps), 0);
    assert_eq!(single_shot_fee, 9);

    let env = Env::default();
    env.mock_all_auths();
    let (client, token_client, treasury, _, recipient) =
        setup_funded_escrow(&env, fee_bps, &amounts);
    for i in 0..amounts.len() as u32 {
        client.release_milestone(&1u64, &i);
    }

    assert_eq!(token_client.balance(&treasury), single_shot_fee);
    assert_eq!(token_client.balance(&recipient), total - single_shot_fee);
}

#[test]
fn test_ten_unit_milestones_under_low_fee_bps() {
    // 10 milestones of 1 unit each at 1000 bps (10%): legacy collected 0,
    // the escrow-total basis collects floor(10 * 1000 / 10000) = 1.
    let fee_bps = 1000i128;
    let amounts = [1i128; 10];

    assert_eq!(legacy_per_milestone_fee(&amounts, fee_bps), 0);

    let env = Env::default();
    env.mock_all_auths();
    let (client, token_client, treasury, _, recipient) =
        setup_funded_escrow(&env, fee_bps, &amounts);
    for i in 0..amounts.len() as u32 {
        client.release_milestone(&1u64, &i);
    }

    assert_eq!(token_client.balance(&treasury), 1);
    assert_eq!(token_client.balance(&recipient), 9);
}

#[test]
fn test_incremental_fee_bounds_and_overflow() {
    use crate::calculate_incremental_fee;

    // Never negative and never exceeds the amount for any valid fee_bps.
    for fee_bps in [0i128, 1, 50, 9_999, 10_000] {
        for settled in [0i128, 1, 199, 9_999, 1_000_000] {
            for amount in [0i128, 1, 2, 199, 10_001] {
                let fee = calculate_incremental_fee(settled, amount, fee_bps).unwrap();
                assert!((0..=amount).contains(&fee));
            }
        }
    }

    // Boundary: overflow surfaces as a clean error, never a wrap or panic.
    assert_eq!(
        calculate_incremental_fee(i128::MAX, 1, 50),
        Err(Error::InvalidMilestoneAmount)
    );
    assert_eq!(
        calculate_incremental_fee(0, i128::MAX, 50),
        Err(Error::InvalidMilestoneAmount)
    );
}
