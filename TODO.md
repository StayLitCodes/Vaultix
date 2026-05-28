# Vaultix - Implementation Tracker

- [x] Add `disputeDeadline` field to backend `Escrow` entity (nullable datetime)
- [ ] Update dispute filing flow (`fileDispute` / `raise_dispute`) to set `escrow.disputeDeadline = now + X days`
- [x] Implement `trigger_default_resolution` in backend: apply fallback when deadline passes and dispute not resolved






- [ ] Add scheduler job (cron) to periodically call `trigger_default_resolution` for expired disputes
- [ ] Update/extend tests (if any exist) for dispute deadline behavior
- [ ] Run backend typecheck/lint/test


