# 🚀 Feature: Party Acceptance Flow & Webhook Retry Mechanism

## 📜 Description
This PR resolves two major issues in Vaultix:
1. **[Issue #58] Escrow Party Acceptance Flow**: Implementing a robust mutual-consent mechanism before escrows can be funded and activated.
2. **[Issue #197] Webhook Retry Mechanism**: Ensuring durability of outgoing webhooks with exponential backoff and a dead-letter queue.

## 🛠️ Changes Made
- **Escrow State Machine**: Escrows can no longer transition from `PENDING` to `ACTIVE` unless all invited parties explicitly have an `ACCEPTED` status.
- **Party Acceptance Endpoints**: Added endpoints `POST /escrows/:id/parties/:partyId/accept` and `reject`.
- **Durable Webhooks**: Introduced `WebhookDelivery` entity to track individual delivery attempts, logging response codes, error messages, and next retry times.
- **Exponential Backoff**: Configured an asynchronous retry queue with an exponential backoff schedule (1s, 2s, 4s, 8s, 16s) up to 5 max attempts.
- **Admin Visibility**: Added endpoints to view permanently failed webhooks (`/admin/failed`), manually trigger retries (`/admin/deliveries/:id/retry`), and check health stats (`/health`).
- **Cron Jobs**: Integrated `@nestjs/schedule` to run a durable sweep for delayed/crashed deliveries.

## ✅ Verification & Testing
- ✅ Added Unit Tests to verify the acceptance workflow and the `EscrowService.fund` constraint.
- ✅ Appended an E2E testing block for Party Acceptance inside `test/e2e/escrow.e2e-spec.ts`.
- ✅ All services inject the required Repositories safely.

## 📌 Related Issues
Closes #58
Closes #197
