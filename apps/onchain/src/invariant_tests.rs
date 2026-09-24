// invariant_tests.rs — regression tests for escrow state invariants
extern crate std;

use super::*;
use soroban_sdk::{symbol_short, testutils::Address as _, vec, Address, BytesN, Env};

fn valid_metadata_hash(env: &Env) -> BytesN<32> {
    BytesN::from_array(env, &[9u8; 32])
}

fn sample_milestones(env: &Env) -> soroban_sdk::Vec<Milestone> {
    vec![
        env,
        Milestone {
            amount: 4_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("M1"),
        },
        Milestone {
            amount: 6_000,
            status: MilestoneStatus::Pending,
            description: symbol_short!("M2"),
        },
    ]
}

fn valid_created_entry(env: &Env) -> EscrowEntryV2 {
    let depositor = Address::generate(env);
    let recipient = Address::generate(env);
    let token_address = Address::generate(env);
    let milestones = sample_milestones(env);

    EscrowEntryV2 {
        depositor,
        recipient,
        token_address,
        total_amount: 10_000,
        total_released: 0,
        milestones,
        packed_state: pack_escrow_state(EscrowStatus::Created, Resolution::None),
        deadline: 9_999,
        threshold_amount: 10_000,
        required_signatures: 1,
        collected_signatures: vec![env],
        fee_override_bps: -1,
        metadata_hash: valid_metadata_hash(env),
        funded_amount: 0,
        approved_signers: vec![env],
    }
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

#[test]
fn test_valid_created_escrow_passes_invariants() {
    let env = Env::default();
    let entry = valid_created_entry(&env);
    assert!(VaultixEscrow::test_validate_escrow_invariants(entry).is_ok());
}

#[test]
fn test_partial_settlement_accounting_reconciles_for_partially_released_escrow() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.packed_state = pack_escrow_state(EscrowStatus::Active, Resolution::None);
    entry.funded_amount = 10_000;
    entry.total_released = 4_000;

    let mut milestones = sample_milestones(&env);
    let mut m0 = milestones.get(0).unwrap();
    m0.status = MilestoneStatus::Released;
    milestones.set(0, m0);
    entry.milestones = milestones;

    assert!(VaultixEscrow::test_validate_escrow_invariants(entry).is_ok());
}

#[test]
fn test_partial_settlement_accounting_rejects_overfunded_released_balance() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.packed_state = pack_escrow_state(EscrowStatus::Active, Resolution::None);
    entry.funded_amount = 3_000;
    entry.total_released = 4_000;

    let mut milestones = sample_milestones(&env);
    let mut m0 = milestones.get(0).unwrap();
    m0.status = MilestoneStatus::Released;
    milestones.set(0, m0);
    let mut m1 = milestones.get(1).unwrap();
    m1.status = MilestoneStatus::Released;
    milestones.set(1, m1);
    entry.milestones = milestones;

    assert_eq!(
        VaultixEscrow::test_validate_escrow_invariants(entry),
        Err(Error::InvalidMilestoneAmount)
    );
}

#[test]
fn test_partial_settlement_invariant_holds_for_partial_sequence() {
    let env = Env::default();
    let total_amount = 10_000i128;
    let funded_amount = total_amount;
    let sequence = [4_000, 10_000];
    let mut total_released = 0i128;

    for release in sequence {
        total_released += release;
        let mut milestones = sample_milestones(&env);
        for i in 0..milestones.len() {
            let mut milestone = milestones.get(i).unwrap();
            if i == 0 && release >= 4_000 {
                milestone.status = MilestoneStatus::Released;
            }
            if i == 1 && release >= 10_000 {
                milestone.status = MilestoneStatus::Released;
            }
            milestones.set(i, milestone);
        }

        let entry = EscrowEntryV2 {
            depositor: Address::generate(&env),
            recipient: Address::generate(&env),
            token_address: Address::generate(&env),
            total_amount,
            total_released,
            milestones,
            packed_state: pack_escrow_state(EscrowStatus::Active, Resolution::None),
            deadline: 9_999,
            threshold_amount: total_amount,
            required_signatures: 1,
            collected_signatures: vec![&env],
            fee_override_bps: -1,
            metadata_hash: valid_metadata_hash(&env),
            funded_amount,
            approved_signers: vec![&env],
        };

        if total_released > funded_amount {
            assert_eq!(
                VaultixEscrow::test_validate_escrow_invariants(entry),
                Err(Error::InvalidMilestoneAmount)
            );
        } else {
            assert!(VaultixEscrow::test_validate_escrow_invariants(entry).is_ok());
        }
    }
}

#[test]
fn test_invariant_total_amount_mismatch_rejected() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.total_amount = 9_000;

    assert_eq!(
        VaultixEscrow::test_validate_escrow_invariants(entry),
        Err(Error::TotalAmountMismatch)
    );
}

#[test]
fn test_invariant_total_released_above_total_amount_rejected() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.total_released = 10_001;

    assert_eq!(
        VaultixEscrow::test_validate_escrow_invariants(entry),
        Err(Error::InvalidMilestoneAmount)
    );
}

#[test]
fn test_invariant_negative_total_released_rejected() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.total_released = -1;

    assert_eq!(
        VaultixEscrow::test_validate_escrow_invariants(entry),
        Err(Error::InvalidMilestoneAmount)
    );
}

#[test]
fn test_invariant_released_milestone_sum_mismatch_rejected() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.packed_state = pack_escrow_state(EscrowStatus::Active, Resolution::None);
    entry.total_released = 4_000;

    // Milestones still pending, so released sum is 0 while total_released is 4_000.
    assert_eq!(
        VaultixEscrow::test_validate_escrow_invariants(entry),
        Err(Error::InvalidMilestoneAmount)
    );
}

#[test]
fn test_invariant_created_with_nonzero_released_rejected() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    let mut milestones = sample_milestones(&env);
    milestones.set(
        0,
        Milestone {
            amount: 4_000,
            status: MilestoneStatus::Released,
            description: symbol_short!("M1"),
        },
    );
    entry.milestones = milestones;
    entry.total_released = 4_000;

    assert_eq!(
        VaultixEscrow::test_validate_escrow_invariants(entry),
        Err(Error::InvalidEscrowStatus)
    );
}

#[test]
fn test_invariant_completed_requires_all_milestones_released() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.packed_state = pack_escrow_state(EscrowStatus::Completed, Resolution::None);
    entry.total_released = 10_000;

    let mut milestones = sample_milestones(&env);
    let mut m0 = milestones.get(0).unwrap();
    m0.status = MilestoneStatus::Released;
    milestones.set(0, m0);
    // M2 is still Pending, so Completed is invalid.
    entry.milestones = milestones;

    assert_eq!(
        VaultixEscrow::test_validate_escrow_invariants(entry),
        Err(Error::InvalidEscrowStatus)
    );
}

#[test]
fn test_invariant_resolved_allows_unmarked_milestones_with_bounded_released() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.packed_state = pack_escrow_state(EscrowStatus::Resolved, Resolution::Recipient);
    entry.total_released = 10_000;

    // In Resolved state, total_released can be up to total_amount even if milestones
    // remain Disputed/Pending (arbitrator distribution).
    assert!(VaultixEscrow::test_validate_escrow_invariants(entry).is_ok());
}

#[test]
fn test_invariant_resolved_rejects_released_sum_greater_than_total_released() {
    let env = Env::default();
    let mut entry = valid_created_entry(&env);
    entry.packed_state = pack_escrow_state(EscrowStatus::Resolved, Resolution::Depositor);
    entry.total_released = 3_000;

    let mut milestones = sample_milestones(&env);
    let mut m0 = milestones.get(0).unwrap();
    m0.status = MilestoneStatus::Released;
    milestones.set(0, m0);
    entry.milestones = milestones;

    // Released milestone amount is 4_000, which exceeds total_released 3_000.
    assert_eq!(
        VaultixEscrow::test_validate_escrow_invariants(entry),
        Err(Error::InvalidMilestoneAmount)
    );
}

#[test]
fn test_valid_status_transitions_pass() {
    assert!(VaultixEscrow::test_validate_status_transition(
        EscrowStatus::Created,
        EscrowStatus::Active
    )
    .is_ok());
    assert!(VaultixEscrow::test_validate_status_transition(
        EscrowStatus::Created,
        EscrowStatus::Cancelled
    )
    .is_ok());
    assert!(VaultixEscrow::test_validate_status_transition(
        EscrowStatus::Active,
        EscrowStatus::Completed
    )
    .is_ok());
    assert!(VaultixEscrow::test_validate_status_transition(
        EscrowStatus::Active,
        EscrowStatus::Disputed
    )
    .is_ok());
    assert!(VaultixEscrow::test_validate_status_transition(
        EscrowStatus::Active,
        EscrowStatus::Cancelled
    )
    .is_ok());
    assert!(VaultixEscrow::test_validate_status_transition(
        EscrowStatus::Active,
        EscrowStatus::Expired
    )
    .is_ok());
    assert!(VaultixEscrow::test_validate_status_transition(
        EscrowStatus::Disputed,
        EscrowStatus::Resolved
    )
    .is_ok());
}

#[test]
fn test_terminal_states_cannot_transition() {
    let terminal = [
        EscrowStatus::Completed,
        EscrowStatus::Cancelled,
        EscrowStatus::Resolved,
        EscrowStatus::Expired,
    ];
    let all = [
        EscrowStatus::Created,
        EscrowStatus::Active,
        EscrowStatus::Completed,
        EscrowStatus::Cancelled,
        EscrowStatus::Disputed,
        EscrowStatus::Resolved,
        EscrowStatus::Expired,
    ];

    for from in terminal {
        for to in all {
            if from == to {
                assert!(VaultixEscrow::test_validate_status_transition(from, to).is_ok());
            } else {
                assert_eq!(
                    VaultixEscrow::test_validate_status_transition(from, to),
                    Err(Error::InvalidEscrowStatus)
                );
            }
        }
    }
}

#[test]
fn test_invalid_arbitrary_transitions_rejected() {
    assert_eq!(
        VaultixEscrow::test_validate_status_transition(
            EscrowStatus::Created,
            EscrowStatus::Completed
        ),
        Err(Error::InvalidEscrowStatus)
    );
    assert_eq!(
        VaultixEscrow::test_validate_status_transition(
            EscrowStatus::Created,
            EscrowStatus::Disputed
        ),
        Err(Error::InvalidEscrowStatus)
    );
    assert_eq!(
        VaultixEscrow::test_validate_status_transition(
            EscrowStatus::Disputed,
            EscrowStatus::Active
        ),
        Err(Error::InvalidEscrowStatus)
    );
    assert_eq!(
        VaultixEscrow::test_validate_status_transition(
            EscrowStatus::Disputed,
            EscrowStatus::Cancelled
        ),
        Err(Error::InvalidEscrowStatus)
    );
}

#[test]
fn test_store_rejects_corrupt_escrow_state() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    token_admin.mint(&depositor, &10_000);

    let escrow_id = 42u64;
    let milestones = sample_milestones(&env);

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &5_000,
        &valid_metadata_hash(&env),
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    let escrow = client.get_escrow(&escrow_id);
    let mut corrupt = VaultixEscrow::test_escrow_entry_from_public(escrow);
    corrupt.total_amount = 99_999;
    client.test_store_escrow_raw(&escrow_id, &corrupt);

    let result = client.try_release_milestone(&escrow_id, &0);
    assert_eq!(result, Err(Ok(Error::TotalAmountMismatch)));
}

#[test]
fn test_release_milestone_maintains_invariants_end_to_end() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    token_admin.mint(&depositor, &10_000);

    let escrow_id = 7u64;
    let milestones = sample_milestones(&env);

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &5_000,
        &valid_metadata_hash(&env),
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);
    client.release_milestone(&escrow_id, &0);

    let escrow = client.get_escrow(&escrow_id);
    assert_eq!(escrow.total_released, 4_000);
    assert_eq!(
        escrow.milestones.get(0).unwrap().status,
        MilestoneStatus::Released
    );
    assert_eq!(escrow.status, EscrowStatus::Active);

    let entry = VaultixEscrow::test_escrow_entry_from_public(escrow);
    assert!(VaultixEscrow::test_validate_escrow_invariants(entry).is_ok());
}

#[test]
fn test_invalid_status_transition_blocked_at_runtime() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let (client, _contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);
    let token_address = Address::generate(&env);

    let mut corrupt = valid_created_entry(&env);
    corrupt.depositor = depositor.clone();
    corrupt.recipient = recipient.clone();
    corrupt.token_address = token_address;
    corrupt.packed_state = pack_escrow_state(EscrowStatus::Completed, Resolution::None);
    corrupt.total_released = 10_000;
    let milestones = vec![
        &env,
        Milestone {
            amount: 4_000,
            status: MilestoneStatus::Released,
            description: symbol_short!("M1"),
        },
        Milestone {
            amount: 6_000,
            status: MilestoneStatus::Released,
            description: symbol_short!("M2"),
        },
    ];
    corrupt.milestones = milestones;

    client.test_store_escrow_raw(&55, &corrupt);

    let result = client.try_cancel_escrow(&55);
    assert_eq!(result, Err(Ok(Error::InvalidEscrowStatus)));
}

#[test]
fn test_release_milestone_rejects_corrupt_released_accounting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    token_admin.mint(&depositor, &10_000);

    let escrow_id = 88u64;
    let milestones = sample_milestones(&env);

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &5_000,
        &valid_metadata_hash(&env),
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    let escrow = client.get_escrow(&escrow_id);
    let mut corrupt = VaultixEscrow::test_escrow_entry_from_public(escrow);
    corrupt.total_released = 4_000;
    client.test_store_escrow_raw(&escrow_id, &corrupt);

    let result = client.try_release_milestone(&escrow_id, &0);
    assert_eq!(result, Err(Ok(Error::InvalidMilestoneAmount)));
}

#[test]
fn test_invalid_status_transition_rejected_at_persistence() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let treasury = Address::generate(&env);
    let (client, contract_id) = create_test_contract(&env, &admin, &treasury, Some(50));

    let depositor = Address::generate(&env);
    let recipient = Address::generate(&env);

    let token_address = env
        .register_stellar_asset_contract_v2(admin.clone())
        .address();
    let token_admin = soroban_sdk::token::StellarAssetClient::new(&env, &token_address);
    let token_client = soroban_sdk::token::Client::new(&env, &token_address);
    token_admin.mint(&depositor, &10_000);

    let escrow_id = 99u64;
    let milestones = sample_milestones(&env);

    client.create_escrow(
        &escrow_id,
        &depositor,
        &recipient,
        &token_address,
        &milestones,
        &5_000,
        &valid_metadata_hash(&env),
    );

    token_client.approve(&depositor, &contract_id, &10_000, &200);
    client.deposit_funds(&escrow_id);

    // Skip Created -> Active and jump straight to Completed (invalid transition).
    let escrow = client.get_escrow(&escrow_id);
    let mut corrupt = VaultixEscrow::test_escrow_entry_from_public(escrow);
    corrupt.packed_state = pack_escrow_state(EscrowStatus::Completed, Resolution::None);
    corrupt.total_released = 10_000;
    let released = vec![
        &env,
        Milestone {
            amount: 4_000,
            status: MilestoneStatus::Released,
            description: symbol_short!("M1"),
        },
        Milestone {
            amount: 6_000,
            status: MilestoneStatus::Released,
            description: symbol_short!("M2"),
        },
    ];
    corrupt.milestones = released;
    client.test_store_escrow_raw(&escrow_id, &corrupt);

    // Attempting another valid-looking transition should fail because terminal
    // Completed cannot move to Cancelled.
    let result = client.try_cancel_escrow(&escrow_id);
    assert_eq!(result, Err(Ok(Error::InvalidEscrowStatus)));
}
