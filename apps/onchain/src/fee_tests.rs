use crate::{Error, Milestone, MilestoneStatus, VaultixEscrow, VaultixEscrowClient};
use soroban_sdk::symbol_short;
/// Comprehensive tests for the Configurable Fee Model feature (#93)
/// Tests cover:
/// - Default global fee behavior (no overrides)
/// - Token-level override only
/// - Escrow-level override only
/// - Combined scenarios ensuring precedence
/// - Invalid fee (out of range) rejections
/// - Fee precedence: escrow > token > global
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token, vec, Address, Env,
};

/// Helper function to create and initialize a test token
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
    assert!(result.is_ok());
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
    let result = client.try_set_escrow_fee(&escrow_id, &75);
    assert!(result.is_ok());
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
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    token_client.approve(&depositor, &contract_id, &10_000, &200);
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
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
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
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
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
fn test_fee_precedence_escrow_over_token_and_global() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50)); // 0.5% global

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

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
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
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

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50)); // 0.5% global fee

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

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

    let deadline = env.ledger().timestamp() + 1; // Set a very short deadline
    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &deadline,
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

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

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

// ---------------------------------------------------------------------------
// Tiered fee tests (issue #132)
// ---------------------------------------------------------------------------

/// Tier 1: amount < 10_000_000_000 (< 1,000 XLM) → 50 bps
/// When initialized without an explicit fee (None), tiers apply.
#[test]
fn test_tiered_fee_tier1_low_volume() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    // No explicit fee → tiered defaults apply
    client.initialize(&treasury, &None);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    // 5_000 tokens — well below Tier 1 threshold (10_000_000_000)
    let amount = 5_000i128;
    token_admin.mint(&depositor, &amount);

    let escrow_id = 200u64;
    let milestones = vec![
        &env,
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
        &(env.ledger().timestamp() + 3600),
    );

    token_client.approve(&depositor, &contract_id, &amount, &200);
    client.deposit_funds(&escrow_id);
    client.release_milestone(&escrow_id, &0);

    // Tier 1 → 50 bps: fee = 5_000 * 50 / 10_000 = 25
    let expected_fee = 25i128;
    let expected_payout = amount - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

/// Tier 2: 10_000_000_000 ≤ amount < 50_000_000_000 → 30 bps
#[test]
fn test_tiered_fee_tier2_medium_volume() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &None);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    // 20_000_000_000 tokens — in the Tier 2 range (1,000–5,000 XLM)
    let amount = 20_000_000_000i128;
    token_admin.mint(&depositor, &amount);

    let escrow_id = 201u64;
    let milestones = vec![
        &env,
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
        &(env.ledger().timestamp() + 3600),
    );

    // Raise threshold so depositor-only auth path is used (avoid multi-sig requirement)
    client.configure_multisig(&escrow_id, &i128::MAX, &1);

    token_client.approve(&depositor, &contract_id, &amount, &200);
    client.deposit_funds(&escrow_id);
    client.release_milestone(&escrow_id, &0);

    // Tier 2 → 30 bps: fee = 20_000_000_000 * 30 / 10_000 = 60_000_000
    let expected_fee = 60_000_000i128;
    let expected_payout = amount - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

/// Tier 3: amount ≥ 50_000_000_000 → 10 bps
#[test]
fn test_tiered_fee_tier3_high_volume() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &None);

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    // 100_000_000_000 tokens — above Tier 3 threshold (> 5,000 XLM)
    let amount = 100_000_000_000i128;
    token_admin.mint(&depositor, &amount);

    let escrow_id = 202u64;
    let milestones = vec![
        &env,
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
        &(env.ledger().timestamp() + 3600),
    );

    // Raise threshold so depositor-only auth path is used
    client.configure_multisig(&escrow_id, &i128::MAX, &1);

    token_client.approve(&depositor, &contract_id, &amount, &200);
    client.deposit_funds(&escrow_id);
    client.release_milestone(&escrow_id, &0);

    // Tier 3 → 10 bps: fee = 100_000_000_000 * 10 / 10_000 = 100_000_000
    let expected_fee = 100_000_000i128;
    let expected_payout = amount - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

/// Explicit global fee override takes priority over tiers.
#[test]
fn test_explicit_global_fee_overrides_tiers() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    // Explicit 100 bps override — even for a Tier 3 amount this should apply
    client.initialize(&treasury, &Some(100));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    // High-volume amount that would normally land in Tier 3 (10 bps)
    let amount = 100_000_000_000i128;
    token_admin.mint(&depositor, &amount);

    let escrow_id = 203u64;
    let milestones = vec![
        &env,
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
        &(env.ledger().timestamp() + 3600),
    );

    // Raise threshold so depositor-only auth path is used
    client.configure_multisig(&escrow_id, &i128::MAX, &1);

    token_client.approve(&depositor, &contract_id, &amount, &200);
    client.deposit_funds(&escrow_id);
    client.release_milestone(&escrow_id, &0);

    // Global override (100 bps) wins: fee = 100_000_000_000 * 100 / 10_000 = 1_000_000_000
    let expected_fee = 1_000_000_000i128;
    let expected_payout = amount - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}

/// Escrow-level override takes priority over tiers even for high-volume amounts.
#[test]
fn test_escrow_fee_override_takes_priority_over_tiers() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, VaultixEscrow);
    let client = VaultixEscrowClient::new(&env, &contract_id);

    let treasury = Address::generate(&env);
    client.initialize(&treasury, &None); // tiers as default

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let admin = Address::generate(&env);

    let (token_client, token_admin, token_address) = create_token_contract(&env, &admin);
    // Tier 3 amount
    let amount = 100_000_000_000i128;
    token_admin.mint(&depositor, &amount);

    let escrow_id = 204u64;
    // Set explicit escrow-level fee of 200 bps (overrides Tier 3's 10 bps)
    client.set_escrow_fee(&escrow_id, &200);

    let milestones = vec![
        &env,
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
        &(env.ledger().timestamp() + 3600),
    );

    // Raise threshold so depositor-only auth path is used
    client.configure_multisig(&escrow_id, &i128::MAX, &1);

    token_client.approve(&depositor, &contract_id, &amount, &200);
    client.deposit_funds(&escrow_id);
    client.release_milestone(&escrow_id, &0);

    // Escrow override (200 bps): fee = 100_000_000_000 * 200 / 10_000 = 2_000_000_000
    let expected_fee = 2_000_000_000i128;
    let expected_payout = amount - expected_fee;

    assert_eq!(token_client.balance(&recipient), expected_payout);
    assert_eq!(token_client.balance(&treasury), expected_fee);
}
