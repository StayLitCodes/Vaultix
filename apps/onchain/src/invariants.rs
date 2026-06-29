use soroban_sdk::Vec;

use super::{
    escrow_status, verify_all_released, Error, EscrowEntryV2, EscrowStatus, Milestone,
    MilestoneStatus,
};

/// Explicit escrow invariant checklist enforced at persistence boundaries.
///
/// 1. `total_amount == sum(milestones.amount)`
/// 2. `0 <= total_released <= total_amount`
/// 3. Released milestone amounts sum to `total_released` for all statuses except
///    `Resolved`, where dispute payouts may credit the recipient without marking
///    milestones as `Released`.
/// 4. Status-specific consistency (e.g. `Completed` requires all milestones released).
pub fn validate_escrow_invariants(escrow: &EscrowEntryV2) -> Result<(), Error> {
    let milestone_sum = sum_milestone_amounts(&escrow.milestones)?;
    if milestone_sum != escrow.total_amount {
        return Err(Error::TotalAmountMismatch);
    }

    if escrow.total_released < 0 || escrow.total_released > escrow.total_amount {
        return Err(Error::InvalidMilestoneAmount);
    }

    validate_status_field_consistency(escrow)?;

    let released_sum = sum_released_milestone_amounts(&escrow.milestones)?;
    let status = escrow_status(escrow);

    if status == EscrowStatus::Resolved {
        if released_sum > escrow.total_released {
            return Err(Error::InvalidMilestoneAmount);
        }
    } else if released_sum != escrow.total_released {
        return Err(Error::InvalidMilestoneAmount);
    }

    Ok(())
}

/// Validates allowed escrow status transitions.
///
/// Terminal states (`Completed`, `Cancelled`, `Resolved`, `Expired`) cannot transition.
pub fn validate_status_transition(from: EscrowStatus, to: EscrowStatus) -> Result<(), Error> {
    if from == to {
        return Ok(());
    }

    let valid = matches!(
        (from, to),
        (EscrowStatus::Created, EscrowStatus::Active)
            | (EscrowStatus::Created, EscrowStatus::Disputed)
            | (EscrowStatus::Created, EscrowStatus::Cancelled)
            | (EscrowStatus::Active, EscrowStatus::Disputed)
            | (EscrowStatus::Active, EscrowStatus::Cancelled)
            | (EscrowStatus::Active, EscrowStatus::Completed)
            | (EscrowStatus::Active, EscrowStatus::Expired)
            | (EscrowStatus::Disputed, EscrowStatus::Resolved)
    );

    if valid {
        Ok(())
    } else {
        Err(Error::InvalidEscrowStatus)
    }
}

fn validate_status_field_consistency(escrow: &EscrowEntryV2) -> Result<(), Error> {
    let status = escrow_status(escrow);

    match status {
        EscrowStatus::Created | EscrowStatus::Cancelled => {
            if escrow.total_released != 0 {
                return Err(Error::InvalidEscrowStatus);
            }
        }
        EscrowStatus::Completed => {
            if escrow.total_released != escrow.total_amount {
                return Err(Error::InvalidEscrowStatus);
            }
            if !verify_all_released(&escrow.milestones) {
                return Err(Error::InvalidEscrowStatus);
            }
        }
        _ => {}
    }

    Ok(())
}

fn sum_milestone_amounts(milestones: &Vec<Milestone>) -> Result<i128, Error> {
    let mut total: i128 = 0;
    for milestone in milestones.iter() {
        total = total
            .checked_add(milestone.amount)
            .ok_or(Error::InvalidMilestoneAmount)?;
    }
    Ok(total)
}

fn sum_released_milestone_amounts(milestones: &Vec<Milestone>) -> Result<i128, Error> {
    let mut total: i128 = 0;
    for milestone in milestones.iter() {
        if milestone.status == MilestoneStatus::Released {
            total = total
                .checked_add(milestone.amount)
                .ok_or(Error::InvalidMilestoneAmount)?;
        }
    }
    Ok(total)
}
