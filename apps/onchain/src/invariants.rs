// invariants.rs
// =============================================================================
// Escrow invariant checker — Issue #216
//
// This module defines a single shared function, `check_escrow_invariants`, that
// validates every structural guarantee that must hold for a well-formed escrow.
// It is called at the *end* of every state-changing function in lib.rs, just
// before the entry is written back to storage.  Calling it on the mutated
// in-memory value (before `store_escrow_entry_v2`) means an invalid transition
// is caught before it can ever be persisted.
//
// Invariants enforced
// -------------------
// I-1  total_amount == sum of all milestone amounts
//      The canonical "budget" must always equal the milestone breakdown.
//
// I-2  0 <= total_released <= total_amount
//      Released funds can never be negative or exceed what was locked.
//
// I-3  sum of Released-milestone amounts == total_released
//      The per-milestone release ledger must agree with the running counter.
//      (Skipped for Resolved escrows — dispute payouts may leave milestones in
//      Disputed status while total_released reflects the actual payout.)
//
// I-4  Status-specific consistency
//      Completed -> all milestones Released, total_released == total_amount.
//
// I-5  total_amount > 0
//      An escrow with no locked value is nonsensical.
//
// I-6  No milestone has a zero or negative amount
//      Caught at creation by validate_milestones; re-enforced here so future
//      refactors cannot bypass it.
// =============================================================================

use crate::{escrow_status, EscrowEntryV2, EscrowStatus, Error, MilestoneStatus};

/// Validate all structural invariants for `escrow`.
///
/// Returns `Ok(())` when every invariant holds.
/// Returns the first `Err(Error::Invariant*)` that fires, so the caller gets
/// the most actionable error code without performing redundant checks.
///
/// **Side-effect free** — never mutates the escrow or touches storage.
pub fn check_escrow_invariants(escrow: &EscrowEntryV2) -> Result<(), Error> {
    // -----------------------------------------------------------------
    // I-5  total_amount must be strictly positive
    // -----------------------------------------------------------------
    if escrow.total_amount <= 0 {
        return Err(Error::InvariantTotalAmountNotPositive);
    }

    // -----------------------------------------------------------------
    // I-6  Every individual milestone amount must be strictly positive
    // -----------------------------------------------------------------
    for milestone in escrow.milestones.iter() {
        if milestone.amount <= 0 {
            return Err(Error::InvariantMilestoneAmountNotPositive);
        }
    }

    // -----------------------------------------------------------------
    // I-1  total_amount == sum(milestone.amount)
    // -----------------------------------------------------------------
    let mut milestone_sum: i128 = 0;
    for milestone in escrow.milestones.iter() {
        milestone_sum = milestone_sum
            .checked_add(milestone.amount)
            .ok_or(Error::InvariantMilestoneSumOverflow)?;
    }
    if milestone_sum != escrow.total_amount {
        return Err(Error::InvariantAmountMismatch);
    }

    // -----------------------------------------------------------------
    // I-2  0 <= total_released <= total_amount
    // -----------------------------------------------------------------
    if escrow.total_released < 0 {
        return Err(Error::InvariantReleasedNegative);
    }
    if escrow.total_released > escrow.total_amount {
        return Err(Error::InvariantReleasedExceedsTotal);
    }

    // -----------------------------------------------------------------
    // I-3  sum(Released milestone amounts) == total_released
    //
    // Resolved escrows are excluded: dispute resolution can mark milestones
    // as Disputed even when a payout occurred (e.g. depositor-wins path),
    // so the milestone statuses and total_released can legitimately diverge.
    // -----------------------------------------------------------------
    let current_status = escrow_status(escrow);
    if current_status != EscrowStatus::Resolved {
        let mut released_sum: i128 = 0;
        for milestone in escrow.milestones.iter() {
            if milestone.status == MilestoneStatus::Released {
                released_sum = released_sum
                    .checked_add(milestone.amount)
                    .ok_or(Error::InvariantMilestoneSumOverflow)?;
            }
        }
        if released_sum != escrow.total_released {
            return Err(Error::InvariantReleasedSumMismatch);
        }
    }

    // -----------------------------------------------------------------
    // I-4  Status-specific consistency checks
    // -----------------------------------------------------------------
    if current_status == EscrowStatus::Completed {
        // Every milestone must be Released in a completed escrow.
        for milestone in escrow.milestones.iter() {
            if milestone.status != MilestoneStatus::Released {
                return Err(Error::InvariantCompletedWithUnreleasedMilestone);
            }
        }
        // total_released must equal total_amount.
        if escrow.total_released != escrow.total_amount {
            return Err(Error::InvariantReleasedExceedsTotal);
        }
    }

    Ok(())
}