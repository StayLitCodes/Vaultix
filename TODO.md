<<<<<<< HEAD
# Vaultix - Implementation Tracker

- [x] Add `disputeDeadline` field to backend `Escrow` entity (nullable datetime)
- [ ] Update dispute filing flow (`fileDispute` / `raise_dispute`) to set `escrow.disputeDeadline = now + X days`
- [x] Implement `trigger_default_resolution` in backend: apply fallback when deadline passes and dispute not resolved






- [ ] Add scheduler job (cron) to periodically call `trigger_default_resolution` for expired disputes
- [ ] Update/extend tests (if any exist) for dispute deadline behavior
- [ ] Run backend typecheck/lint/test

=======
# Dispute Deadline Implementation TODO

## Steps:
- [x] 1. Update Escrow entity (`escrow.entity.ts`): add `disputeDeadline` column, `Dispute` import, and `OneToOne` decorator imports
- [x] 2. Update EscrowEvent enum (`escrow-event.entity.ts`): add `DISPUTE_TIMEOUT = 'dispute_timeout'`
- [x] 3. Fix Escrow controller (`escrow.controller.ts`): add missing `AdminGuard` import
- [x] 4. Fix Escrow service (`escrow.service.ts`): replace string cast with `EscrowEventType.DISPUTE_TIMEOUT`
- [ ] 5. Update on-chain types (`lib.rs`): add `dispute_deadline: u64` to `Escrow` and `EscrowEntryV2` structs; update mapping functions
- [ ] 6. Update on-chain `raise_dispute` (`lib.rs`): set `dispute_deadline` when raising a dispute
- [ ] 7. Implement on-chain `trigger_default_resolution` (`lib.rs`): auto-resolve with 50/50 split after deadline
- [ ] 8. Add on-chain tests (`test.rs`): verify deadline setting and default resolution behavior
- [ ] 9. Verify backend builds (`npm run build`)
- [ ] 10. Verify on-chain tests pass (`cargo test`)

**Next:** Start editing files
>>>>>>> 589aa69adea7ff0b1b7706d1c0e19a7ffa6ba997

