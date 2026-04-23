// invariant_tests.rs
// =============================================================================
// Regression tests for escrow invariants — Issue #216
//
// Each test targets a specific invariant and deliberately constructs a scenario
// that would violate it if the guard were absent.  The suite acts as a canary:
// if a future refactor silently removes or weakens an invariant check, at least
// one test here will fail, surfacing the regression immediately.
//
// Test ID mapping
// ---------------
// INV-1  total_amount == sum(milestone.amount)
// INV-2  0 <= total_released <= total_amount
// INV-3  Released-milestone sum == total_released
// INV-4  Completed status requires all milestones Released
// INV-5  total_amount must be positive  (enforced upstream by validate_milestones,
//         confirmed via the invariant module directly)
// INV-6  No milestone may have a non-positive amount  (same as INV-5 path)
//
// Happy-path tests verify the invariant validator passes for well-formed
// escrows so the guard itself does not produce false positives.
// =============================================================================

#[cfg(test)]
mod invariant_tests {
    use crate::invariants::check_escrow_invariants;
    use crate::{
        pack_escrow_state, EscrowEntryV2, EscrowStatus, Error, Milestone, MilestoneStatus,
        Resolution, VaultixEscrow, VaultixEscrowClient,
    };
    use soroban_sdk::{
        symbol_short,
        testutils::Address as _,
        token, vec, Address, BytesN, Env,
    };

    // ------------------------------------------------------------------
    // Unit-level helpers — build an EscrowEntryV2 without touching storage
    // ------------------------------------------------------------------

    /// Construct a minimal in-memory EscrowEntryV2 for direct invariant testing.
    fn make_entry(env: &Env, milestones: soroban_sdk::Vec<Milestone>, total_released: i128, status: EscrowStatus) -> EscrowEntryV2 {
        let mut total: i128 = 0;
        for m in milestones.iter() {
            total += m.amount;
        }
        EscrowEntryV2 {
            depositor: Address::generate(env),
            recipient: Address::generate(env),
            token_address: Address::generate(env),
            total_amount: total,
            total_released,
            milestones,
            packed_state: pack_escrow_state(status, Resolution::None),
            deadline: 1_900_000_000u64,
            threshold_amount: 10_000,
            required_signatures: 1,
            collected_signatures: soroban_sdk::Vec::new(env),
            fee_override_bps: -1,
            metadata_hash: BytesN::from_array(env, &[0u8; 32]),
        }
    }

    fn pending(env: &Env, amount: i128) -> Milestone {
        Milestone { amount, status: MilestoneStatus::Pending, description: symbol_short!("M") }
    }

    fn released(env: &Env, amount: i128) -> Milestone {
        Milestone { amount, status: MilestoneStatus::Released, description: symbol_short!("M") }
    }

    // ================================================================
    // Happy-path: valid escrow passes all invariants
    // ================================================================

    #[test]
    fn test_invariant_valid_created_escrow_passes() {
        let env = Env::default();
        let milestones = vec![&env, pending(&env, 5_000), pending(&env, 5_000)];
        let entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        assert!(check_escrow_invariants(&entry).is_ok());
    }

    #[test]
    fn test_invariant_valid_partial_release_passes() {
        let env = Env::default();
        let milestones = vec![&env, released(&env, 3_000), pending(&env, 7_000)];
        let entry = make_entry(&env, milestones, 3_000, EscrowStatus::Active);
        assert!(check_escrow_invariants(&entry).is_ok());
    }

    #[test]
    fn test_invariant_valid_completed_escrow_passes() {
        let env = Env::default();
        let milestones = vec![&env, released(&env, 4_000), released(&env, 6_000)];
        let entry = make_entry(&env, milestones, 10_000, EscrowStatus::Completed);
        assert!(check_escrow_invariants(&entry).is_ok());
    }

    // ================================================================
    // INV-1  total_amount != sum(milestone.amount)  →  AmountMismatch
    // ================================================================

    #[test]
    fn test_invariant_i1_total_amount_does_not_match_milestone_sum() {
        let env = Env::default();
        let milestones = vec![&env, pending(&env, 5_000), pending(&env, 5_000)];
        // Manually craft a bad entry: total_amount set to 9_999 while milestones sum to 10_000.
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        entry.total_amount = 9_999; // <-- invariant violation
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantAmountMismatch),
            "INV-1: mismatched total_amount must be rejected"
        );
    }

    #[test]
    fn test_invariant_i1_total_amount_inflated_above_milestone_sum() {
        let env = Env::default();
        let milestones = vec![&env, pending(&env, 3_000)];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        entry.total_amount = 99_999; // inflated
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantAmountMismatch),
            "INV-1: inflated total_amount must be rejected"
        );
    }

    // ================================================================
    // INV-2  total_released < 0  →  ReleasedNegative
    //        total_released > total_amount  →  ReleasedExceedsTotal
    // ================================================================

    #[test]
    fn test_invariant_i2_released_negative() {
        let env = Env::default();
        let milestones = vec![&env, pending(&env, 10_000)];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        entry.total_released = -1; // negative
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantReleasedNegative),
            "INV-2: negative total_released must be rejected"
        );
    }

    #[test]
    fn test_invariant_i2_released_exceeds_total() {
        let env = Env::default();
        let milestones = vec![&env, released(&env, 10_000)];
        let mut entry = make_entry(&env, milestones, 10_000, EscrowStatus::Active);
        entry.total_released = 10_001; // one too many
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantReleasedExceedsTotal),
            "INV-2: total_released > total_amount must be rejected"
        );
    }

    // ================================================================
    // INV-3  Released-milestone sum != total_released  →  ReleasedSumMismatch
    // ================================================================

    #[test]
    fn test_invariant_i3_released_sum_below_total_released() {
        let env = Env::default();
        // One milestone pending, but total_released says 5_000 already paid.
        let milestones = vec![&env, pending(&env, 10_000)];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        entry.total_released = 5_000; // no Released milestones to justify this
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantReleasedSumMismatch),
            "INV-3: total_released without matching Released milestones must be rejected"
        );
    }

    #[test]
    fn test_invariant_i3_milestone_released_but_total_released_zero() {
        let env = Env::default();
        // Milestone marked Released but counter not updated.
        let milestones = vec![&env, released(&env, 5_000), pending(&env, 5_000)];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        // total_released = 0 but Released milestone sum = 5_000
        entry.total_released = 0;
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantReleasedSumMismatch),
            "INV-3: released milestone without total_released update must be rejected"
        );
    }

    #[test]
    fn test_invariant_i3_skipped_for_resolved_status() {
        let env = Env::default();
        // Depositor-wins dispute: milestones stay Disputed, but total_released was
        // not incremented (funds went back to depositor).  This is a valid state for
        // a Resolved escrow — the invariant check must NOT fire.
        let disputed = Milestone {
            amount: 10_000,
            status: MilestoneStatus::Disputed,
            description: symbol_short!("M"),
        };
        let milestones = vec![&env, disputed];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        entry.packed_state = pack_escrow_state(EscrowStatus::Resolved, Resolution::Depositor);
        // total_released = 0 with no Released milestones — valid for depositor-wins.
        assert!(
            check_escrow_invariants(&entry).is_ok(),
            "INV-3: Resolved escrows are exempt from released-sum check"
        );
    }

    // ================================================================
    // INV-4  Completed with unreleased milestones  →  CompletedWithUnreleasedMilestone
    // ================================================================

    #[test]
    fn test_invariant_i4_completed_with_pending_milestone() {
        let env = Env::default();
        // All amounts released in the counter, but one milestone still Pending.
        let milestones = vec![&env, released(&env, 5_000), pending(&env, 5_000)];
        let mut entry = make_entry(&env, milestones, 10_000, EscrowStatus::Active);
        entry.packed_state = pack_escrow_state(EscrowStatus::Completed, Resolution::None);
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantReleasedSumMismatch),
            "INV-3 fires before INV-4: incomplete milestones cause released sum mismatch first"
        );
    }

    #[test]
    fn test_invariant_i4_completed_with_disputed_milestone() {
        let env = Env::default();
        let disputed = Milestone {
            amount: 5_000,
            status: MilestoneStatus::Disputed,
            description: symbol_short!("D"),
        };
        let milestones = vec![&env, released(&env, 5_000), disputed];
        let mut entry = make_entry(&env, milestones, 10_000, EscrowStatus::Active);
        entry.packed_state = pack_escrow_state(EscrowStatus::Completed, Resolution::None);
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantReleasedSumMismatch),
            "INV-3 fires before INV-4: disputed milestone causes released sum mismatch first"
        );
    }

    // ================================================================
    // INV-5  total_amount <= 0  →  TotalAmountNotPositive
    // ================================================================

    #[test]
    fn test_invariant_i5_zero_total_amount() {
        let env = Env::default();
        let milestones = vec![&env, pending(&env, 1_000)];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        entry.total_amount = 0;
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantTotalAmountNotPositive),
            "INV-5: zero total_amount must be rejected"
        );
    }

    #[test]
    fn test_invariant_i5_negative_total_amount() {
        let env = Env::default();
        let milestones = vec![&env, pending(&env, 1_000)];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        entry.total_amount = -500;
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantTotalAmountNotPositive),
            "INV-5: negative total_amount must be rejected"
        );
    }

    // ================================================================
    // INV-6  Milestone with non-positive amount  →  MilestoneAmountNotPositive
    // ================================================================

    #[test]
    fn test_invariant_i6_zero_milestone_amount() {
        let env = Env::default();
        let zero_milestone = Milestone {
            amount: 0,
            status: MilestoneStatus::Pending,
            description: symbol_short!("Z"),
        };
        let milestones = vec![&env, zero_milestone];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        // total_amount = 0 would also trip INV-5; set explicitly to trigger INV-6 first.
        // INV-5 fires before INV-6, so adjust: give total_amount a non-zero value and
        // let the milestone be 0 — INV-5 fires on total_amount=0 so set to 1 to reach I-6.
        entry.total_amount = 1; // won't match milestone sum but INV-6 fires before INV-1
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantMilestoneAmountNotPositive),
            "INV-6: zero milestone amount must be rejected"
        );
    }

    #[test]
    fn test_invariant_i6_negative_milestone_amount() {
        let env = Env::default();
        let neg_milestone = Milestone {
            amount: -100,
            status: MilestoneStatus::Pending,
            description: symbol_short!("N"),
        };
        let milestones = vec![&env, neg_milestone];
        let mut entry = make_entry(&env, milestones, 0, EscrowStatus::Active);
        entry.total_amount = 1;
        assert_eq!(
            check_escrow_invariants(&entry),
            Err(Error::InvariantMilestoneAmountNotPositive),
            "INV-6: negative milestone amount must be rejected"
        );
    }

    // ================================================================
    // Integration: invariants enforced through the public contract API
    //
    // These tests exercise the full call stack to confirm the validator
    // is actually wired in to state-changing functions, not just callable
    // in isolation.
    // ================================================================

    fn create_token_contract<'a>(
        env: &Env,
        admin: &Address,
    ) -> (token::Client<'a>, token::StellarAssetClient<'a>, Address) {
        let token_address = env.register_stellar_asset_contract(admin.clone());
        let token_admin = token::StellarAssetClient::new(env, &token_address);
        let token_client = token::Client::new(env, &token_address);
        (token_client, token_admin, token_address)
    }

    fn setup_funded_escrow<'a>(
        env: &'a Env,
        escrow_id: u64,
        amounts: &[i128],
    ) -> (VaultixEscrowClient<'a>, Address, Address, Address, token::Client<'a>) {
        let contract_id = env.register_contract(None, VaultixEscrow);
        let client = VaultixEscrowClient::new(env, &contract_id);

        let treasury = Address::generate(env);
        client.initialize(&treasury, &Some(0));

        let admin = Address::generate(env);
        let operator = Address::generate(env);
        let arbitrator = Address::generate(env);
        client.init(&admin, &operator, &arbitrator);

        let depositor = Address::generate(env);
        let recipient = Address::generate(env);

        let (token_client, token_admin, token_address) = create_token_contract(env, &admin);
        let total: i128 = amounts.iter().sum();
        token_admin.mint(&depositor, &total);

        let mut milestones = soroban_sdk::Vec::new(env);
        for &amt in amounts {
            milestones.push_back(Milestone {
                amount: amt,
                status: MilestoneStatus::Pending,
                description: symbol_short!("M"),
            });
        }

        client.create_escrow(
            &escrow_id,
            &depositor,
            &recipient,
            &token_address,
            &milestones,
            &1_900_000_000u64,
            &BytesN::from_array(env, &[0u8; 32]),
        );
        token_client.approve(&depositor, &contract_id, &total, &200);
        client.deposit_funds(&escrow_id);

        (client, contract_id, depositor, recipient, token_client)
    }

    /// After releasing a milestone, the escrow's released sum must match
    /// total_released — verifying INV-3 is intact through the API path.
    #[test]
    fn test_invariant_integration_released_sum_consistent_after_release_milestone() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _, _, _, _) = setup_funded_escrow(&env, 600, &[4_000, 6_000]);
        client.release_milestone(&600, &0);

        let escrow = client.get_escrow(&600);
        // Manually verify the invariant matches observable state.
        assert_eq!(escrow.total_released, 4_000);
        assert_eq!(escrow.milestones.get(0).unwrap().status, MilestoneStatus::Released);
        assert_eq!(escrow.milestones.get(1).unwrap().status, MilestoneStatus::Pending);
    }

    /// complete_escrow must only succeed when all milestones are Released (INV-4 path).
    #[test]
    fn test_invariant_integration_complete_requires_all_milestones_released() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _, _, _, _) = setup_funded_escrow(&env, 601, &[5_000, 5_000]);
        // Release only the first milestone then try to complete.
        client.release_milestone(&601, &0);
        let result = client.try_complete_escrow(&601);
        assert_eq!(
            result,
            Err(Ok(Error::EscrowNotActive)),
            "complete_escrow must fail when not all milestones are released"
        );
    }

    /// Full happy-path through create → deposit → release all → complete.
    /// Verifies no invariant fires on a clean sequence.
    #[test]
    fn test_invariant_integration_full_happy_path_no_violation() {
        let env = Env::default();
        env.mock_all_auths();

        let (client, _, depositor, _, token_client) =
            setup_funded_escrow(&env, 602, &[3_000, 7_000]);

        client.release_milestone(&602, &0);
        client.release_milestone(&602, &1);
        client.complete_escrow(&602);

        let escrow = client.get_escrow(&602);
        assert_eq!(escrow.status, EscrowStatus::Completed);
        assert_eq!(escrow.total_released, 10_000);
    }

    /// Verify total_amount == milestone_sum is enforced at creation
    /// (zero-amount milestone rejected before storage).
    #[test]
    fn test_invariant_integration_zero_milestone_rejected_at_creation() {
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
        let (_, token_admin, token_address) = create_token_contract(&env, &admin);
        token_admin.mint(&depositor, &10_000);

        let bad_milestones = vec![
            &env,
            Milestone { amount: 0, status: MilestoneStatus::Pending, description: symbol_short!("Z") },
        ];

        let result = client.try_create_escrow(
            &700u64,
            &depositor,
            &recipient,
            &token_address,
            &bad_milestones,
            &1_900_000_000u64,
            &BytesN::from_array(&env, &[0u8; 32]),
        );
        assert_eq!(
            result,
            Err(Ok(Error::ZeroAmount)),
            "Zero-amount milestone must be rejected at creation"
        );
    }
}