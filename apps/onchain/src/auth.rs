use soroban_sdk::{Address, Env};

use crate::{Error, get_admin, get_operator, get_arbitrator};

/// Require that the caller is the admin
pub fn require_admin(env: &Env, caller: &Address) -> Result<(), Error> {
    let admin = get_admin(env)?;
    if caller != &admin {
        return Err(Error::UnauthorizedAccess);
    }
    caller.require_auth();
    Ok(())
}

/// Require that the caller is the operator
pub fn require_operator(env: &Env, caller: &Address) -> Result<(), Error> {
    let operator = get_operator(env)?;
    if caller != &operator {
        return Err(Error::UnauthorizedAccess);
    }
    caller.require_auth();
    Ok(())
}

/// Require that the caller is the arbitrator
pub fn require_arbitrator(env: &Env, caller: &Address) -> Result<(), Error> {
    let arbitrator = get_arbitrator(env)?;
    if caller != &arbitrator {
        return Err(Error::UnauthorizedAccess);
    }
    caller.require_auth();
    Ok(())
}

/// Require that the caller is the depositor of an escrow
pub fn require_depositor(env: &Env, caller: &Address, escrow_depositor: &Address) -> Result<(), Error> {
    if caller != escrow_depositor {
        return Err(Error::UnauthorizedAccess);
    }
    caller.require_auth();
    Ok(())
}

/// Require that the caller is either depositor or recipient
pub fn require_party(env: &Env, caller: &Address, depositor: &Address, recipient: &Address) -> Result<(), Error> {
    if caller != depositor && caller != recipient {
        return Err(Error::UnauthorizedAccess);
    }
    caller.require_auth();
    Ok(())
}