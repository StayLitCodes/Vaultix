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

// ---------------------------------------------------------------------------
// Issue #728: checks-effects-interactions + re-entrancy guard
// ---------------------------------------------------------------------------

pub(crate) mod reentrant_token {
    use soroban_sdk::{contract, contractimpl, symbol_short, Address, Env, Symbol};

    use crate::{Error, VaultixEscrowClient};

    pub const ATTACK_NONE: u32 = 0;
    pub const ATTACK_RELEASE: u32 = 1;
    pub const ATTACK_CANCEL: u32 = 2;
    pub const ATTACK_REFUND: u32 = 3;
    pub const ATTACK_RESOLVE: u32 = 4;

    /// Re-entrant call outcome recorded by the token.
    pub const OUTCOME_NOT_ATTEMPTED: u32 = 0;
    pub const OUTCOME_SUCCEEDED: u32 = 1;
    pub const OUTCOME_GUARD_REJECTED: u32 = 2;
    pub const OUTCOME_OTHER_CONTRACT_ERROR: u32 = 3;
    pub const OUTCOME_HOST_REJECTED: u32 = 4;

    fn bal_key(id: &Address) -> (Symbol, Address) {
        (symbol_short!("bal"), id.clone())
    }

    /// Minimal SEP-41-shaped token whose `transfer` re-enters VaultixEscrow.
    #[contract]
    pub struct ReentrantToken;

    #[contractimpl]
    impl ReentrantToken {
        pub fn arm(env: Env, escrow: Address, mode: u32, escrow_id: u64, arg: Address) {
            let s = env.storage().instance();
            s.set(&symbol_short!("escrow"), &escrow);
            s.set(&symbol_short!("mode"), &mode);
            s.set(&symbol_short!("eid"), &escrow_id);
            s.set(&symbol_short!("arg"), &arg);
            s.set(&symbol_short!("outcome"), &OUTCOME_NOT_ATTEMPTED);
        }

        pub fn outcome(env: Env) -> u32 {
            env.storage()
                .instance()
                .get(&symbol_short!("outcome"))
                .unwrap_or(OUTCOME_NOT_ATTEMPTED)
        }

        pub fn mint(env: Env, to: Address, amount: i128) {
            let b = Self::balance(env.clone(), to.clone());
            env.storage().persistent().set(&bal_key(&to), &(b + amount));
        }

        pub fn balance(env: Env, id: Address) -> i128 {
            env.storage().persistent().get(&bal_key(&id)).unwrap_or(0)
        }

        pub fn allowance(_env: Env, _from: Address, _spender: Address) -> i128 {
            i128::MAX
        }

        pub fn transfer_from(
            env: Env,
            _spender: Address,
            from: Address,
            to: Address,
            amount: i128,
        ) {
            Self::move_balance(&env, &from, &to, amount);
        }

        pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
            Self::move_balance(&env, &from, &to, amount);

            let s = env.storage().instance();
            let mode: u32 = s.get(&symbol_short!("mode")).unwrap_or(ATTACK_NONE);
            if mode == ATTACK_NONE {
                return;
            }
            // Attack once.
            s.set(&symbol_short!("mode"), &ATTACK_NONE);

            let escrow: Address = s.get(&symbol_short!("escrow")).unwrap();
            let escrow_id: u64 = s.get(&symbol_short!("eid")).unwrap();
            let arg: Address = s.get(&symbol_short!("arg")).unwrap();
            let client = VaultixEscrowClient::new(&env, &escrow);

            let result = match mode {
                ATTACK_RELEASE => client.try_release_milestone(&escrow_id, &0u32).map(|_| ()),
                ATTACK_CANCEL => client.try_cancel_escrow(&escrow_id).map(|_| ()),
                ATTACK_REFUND => client.try_refund_expired(&escrow_id, &arg).map(|_| ()),
                _ => client
                    .try_resolve_dispute(&escrow_id, &arg, &None, &None)
                    .map(|_| ()),
            };
            let outcome = match result {
                Ok(_) => OUTCOME_SUCCEEDED,
                Err(Ok(Error::ReentrantCall)) => OUTCOME_GUARD_REJECTED,
                Err(Ok(_)) => OUTCOME_OTHER_CONTRACT_ERROR,
                Err(Err(_)) => OUTCOME_HOST_REJECTED,
            };
            s.set(&symbol_short!("outcome"), &outcome);
        }
    }

    impl ReentrantToken {
        fn move_balance(env: &Env, from: &Address, to: &Address, amount: i128) {
            let fb = Self::balance(env.clone(), from.clone());
            let tb = Self::balance(env.clone(), to.clone());
            env.storage()
                .persistent()
                .set(&bal_key(from), &(fb - amount));
            env.storage().persistent().set(&bal_key(to), &(tb + amount));
        }
    }
}

use reentrant_token::{ReentrantToken, ReentrantTokenClient};
use soroban_sdk::testutils::Ledger as _;

struct ReentrancySetup<'a> {
    env: Env,
    client: VaultixEscrowClient<'a>,
    contract_id: Address,
    token: ReentrantTokenClient<'a>,
    depositor: Address,
    recipient: Address,
    arbitrator: Address,
}

/// Funds escrow 1 (two milestones, 10_000 total) with a re-entrant token, plus
/// a second funded escrow (2) so the contract's pooled balance could cover a
/// double payout if re-entry were possible.
fn setup_reentrancy<'a>() -> ReentrancySetup<'a> {
    let env = Env::default();
    env.mock_all_auths_allowing_non_root_auth();

    let admin = Address::generate(&env);
    let operator = Address::generate(&env);
    let arbitrator = Address::generate(&env);
    let treasury = Address::generate(&env);
    let contract_id = env.register(
        VaultixEscrow,
        (&admin, &operator, &arbitrator, &treasury, Some(0i128)),
    );
    let client = VaultixEscrowClient::new(&env, &contract_id);

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
            &sample_milestones(&env),
            &(env.ledger().timestamp() + 3600),
            &valid_metadata_hash(&env),
        );
        client.deposit_funds(&escrow_id);
    }
    assert_eq!(token.balance(&contract_id), 20_000);

    ReentrancySetup {
        env,
        client,
        contract_id,
        token,
        depositor,
        recipient,
        arbitrator,
    }
}

// Note: today the Soroban host itself refuses contract re-entry, so these
// attacks surface as OUTCOME_HOST_REJECTED. The assertions only require that
// re-entry did not succeed and funds moved once; the contract-level guard is
// exercised directly by test_escrow_lock_rejects_reentry_and_is_released_after_success.
#[test]
fn test_reentrant_token_cannot_release_milestone_twice() {
    let t = setup_reentrancy();
    t.token.arm(
        &t.contract_id,
        &reentrant_token::ATTACK_RELEASE,
        &1u64,
        &t.depositor,
    );

    t.client.release_milestone(&1u64, &0);

    let outcome = t.token.outcome();
    assert_ne!(outcome, reentrant_token::OUTCOME_NOT_ATTEMPTED);
    assert_ne!(outcome, reentrant_token::OUTCOME_SUCCEEDED);

    // Milestone 0 (4_000) paid exactly once; persisted state matches.
    assert_eq!(t.token.balance(&t.recipient), 4_000);
    assert_eq!(t.token.balance(&t.contract_id), 16_000);
    let escrow = t.client.get_escrow(&1u64);
    assert_eq!(escrow.total_released, 4_000);
    assert_eq!(
        escrow.milestones.get(0).unwrap().status,
        MilestoneStatus::Released
    );
}

#[test]
fn test_reentrant_token_cannot_double_cancel() {
    let t = setup_reentrancy();
    t.token.arm(
        &t.contract_id,
        &reentrant_token::ATTACK_CANCEL,
        &1u64,
        &t.depositor,
    );

    t.client.cancel_escrow(&1u64);

    let outcome = t.token.outcome();
    assert_ne!(outcome, reentrant_token::OUTCOME_NOT_ATTEMPTED);
    assert_ne!(outcome, reentrant_token::OUTCOME_SUCCEEDED);
    assert_eq!(t.token.balance(&t.depositor), 10_000);
    assert_eq!(t.token.balance(&t.contract_id), 10_000);
    assert_eq!(t.client.get_escrow(&1u64).status, EscrowStatus::Cancelled);
}

#[test]
fn test_reentrant_token_cannot_double_refund_expired() {
    let t = setup_reentrancy();
    t.env.ledger().with_mut(|l| l.timestamp += 3601);
    t.token.arm(
        &t.contract_id,
        &reentrant_token::ATTACK_REFUND,
        &1u64,
        &t.depositor,
    );

    t.client.refund_expired(&1u64, &t.depositor);

    let outcome = t.token.outcome();
    assert_ne!(outcome, reentrant_token::OUTCOME_NOT_ATTEMPTED);
    assert_ne!(outcome, reentrant_token::OUTCOME_SUCCEEDED);
    assert_eq!(t.token.balance(&t.depositor), 10_000);
    assert_eq!(t.token.balance(&t.contract_id), 10_000);
    assert_eq!(t.client.get_escrow(&1u64).status, EscrowStatus::Expired);
}

#[test]
fn test_reentrant_token_cannot_double_resolve_dispute() {
    let t = setup_reentrancy();
    t.client
        .raise_dispute(&1u64, &t.depositor, &BytesN::from_array(&t.env, &[3u8; 32]));
    t.token.arm(
        &t.contract_id,
        &reentrant_token::ATTACK_RESOLVE,
        &1u64,
        &t.recipient,
    );

    t.client.resolve_dispute(&1u64, &t.recipient, &None, &None);

    let outcome = t.token.outcome();
    assert_ne!(outcome, reentrant_token::OUTCOME_NOT_ATTEMPTED);
    assert_ne!(outcome, reentrant_token::OUTCOME_SUCCEEDED);
    assert_eq!(t.token.balance(&t.recipient), 10_000);
    assert_eq!(t.token.balance(&t.contract_id), 10_000);
    let escrow = t.client.get_escrow(&1u64);
    assert_eq!(escrow.status, EscrowStatus::Resolved);
    assert_eq!(escrow.total_released, 10_000);
    let _ = &t.arbitrator;
}

/// The guard itself: a fund-moving call on an escrow whose lock is held is
/// rejected with ReentrantCall, and the lock is released after a normal call.
#[test]
fn test_escrow_lock_rejects_reentry_and_is_released_after_success() {
    let t = setup_reentrancy();

    t.env.as_contract(&t.contract_id, || {
        enter_escrow_lock(&t.env, 1u64).unwrap();
    });
    assert_eq!(
        t.client.try_release_milestone(&1u64, &0),
        Err(Ok(Error::ReentrantCall))
    );
    assert_eq!(
        t.client.try_cancel_escrow(&1u64),
        Err(Ok(Error::ReentrantCall))
    );
    assert_eq!(
        t.client.try_refund_expired(&1u64, &t.depositor),
        Err(Ok(Error::ReentrantCall))
    );
    assert_eq!(
        t.client.try_confirm_delivery(&1u64, &0, &t.depositor),
        Err(Ok(Error::ReentrantCall))
    );
    assert_eq!(
        t.client
            .try_resolve_dispute(&1u64, &t.recipient, &None, &None),
        Err(Ok(Error::ReentrantCall))
    );
    // Other escrows are unaffected by escrow 1's lock.
    t.client.release_milestone(&2u64, &0);

    t.env.as_contract(&t.contract_id, || {
        exit_escrow_lock(&t.env, 1u64);
    });
    t.client.release_milestone(&1u64, &0);
    // Lock was released on success, so the next call is not blocked.
    t.client.release_milestone(&1u64, &1);
    assert_eq!(t.client.get_escrow(&1u64).total_released, 10_000);
}
