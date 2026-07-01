# Vaultix Backend (NestJS) Issues - Wave 3

Below are 10 new issues identified for the Vaultix backend API to enhance performance, security, and developer experience.

---

### 1. [Stellar] Replace Consistency Checker Placeholder with Actual Soroban Integration
**Label:** `bug`, `high-priority`
**Complexity:** 200 points
**Description:**
The `ConsistencyCheckerService` currently uses a placeholder for on-chain data fetching. This must be replaced with a real implementation using the `SorobanClientService` to compare database state against on-chain reality.
**Tasks:**
- [ ] Implement `getEscrowFromChain` in `SorobanClientService`.
- [ ] Update `ConsistencyCheckerService` to use actual data.
- [ ] Add unit tests for mismatch detection.

### 2. [Webhooks] Implement Exponential Backoff and Dead Letter Queues
**Label:** `reliability`, `webhooks`
**Complexity:** 150 points
**Description:**
Improve the current `WebhookService` to handle delivery failures more gracefully. Implement a retry mechanism with exponential backoff and move failing hooks to a dead-letter queue for manual intervention.
**Tasks:**
- [ ] Integrate a retry library (e.g., `got` or custom).
- [ ] Store delivery history in the database.
- [ ] Create an admin endpoint to re-run failed hooks.

### 3. [Real-time] WebSocket Integration for Live Escrow Status Updates
**Label:** `feature`, `ux`
**Complexity:** 150 points
**Description:**
Add WebSocket support to push updates to the frontend instantly when an escrow's status changes. This replaces the need for polling or manual refreshing.
**Tasks:**
- [ ] Set up a `Socket.io` gateway in NestJS.
- [ ] Implement event-based broadcasting in `EscrowService`.
- [ ] Add authentication to the WebSocket connection.

### 4. [Audit] Advanced Admin Audit Log with Export and Filtering
**Label:** `feature`, `admin`
**Complexity:** 150 points
**Description:**
Enhance the `AdminAuditLogController` to support complex queries, date range filtering, and CSV/JSON export for compliance reporting.
**Tasks:**
- [ ] Add pagination and sorting to the audit log endpoint.
- [ ] Implement date range and user-based filters.
- [ ] Create a CSV export service for admins.

### 5. [Performance] Implement Redis-based Caching for Frequently Accessed Escrows
**Label:** `performance`, `caching`
**Complexity:** 150 points
**Description:**
Optimize read operations for high-traffic escrows by caching their on-chain data in Redis. This reduces the load on the Stellar RPC nodes.
**Tasks:**
- [ ] Set up a Redis cache manager in NestJS.
- [ ] Implement a cache-aside pattern for escrow lookups.
- [ ] Ensure cache invalidation when a new Stellar event is received.

### 6. [Security] Rate Limiting and API Key Scoping
**Label:** `security`, `api`
**Complexity:** 150 points
**Description:**
Add granular permissions to API keys (e.g., read-only, create-only) and implement rate limiting per API key to prevent abuse.
**Tasks:**
- [ ] Expand the `ApiKey` entity with `scopes`.
- [ ] Implement a custom `RateLimitGuard` using Redis.
- [ ] Update the `ApiKeyGuard` to check for required scopes.

### 7. [UX] Multi-Currency Price Oracle Integration
**Label:** `feature`, `ux`
**Complexity:** 150 points
**Description:**
Fetch and display XLM/USD rates in the `EscrowController` responses. This helps users understand the value of their locked funds in fiat currency.
**Tasks:**
- [ ] Integrate a price feed API (e.g., CoinGecko or CoinMarketCap).
- [ ] Implement a caching service for price data.
- [ ] Update escrow DTOs to include fiat estimates.

### 8. [Docs] Automated Swagger/OpenAPI Documentation Generation
**Label:** `documentation`, `dx`
**Complexity:** 100 points
**Description:**
Ensure all endpoints are fully documented and testable via Swagger UI. This improves developer experience for third-party integrations.
**Tasks:**
- [ ] Decorate all controllers with `@ApiTags`, `@ApiOperation`, etc.
- [ ] Define request/response DTOs for all endpoints.
- [ ] Enable the Swagger module in `main.ts`.

### 9. [Testing] Comprehensive E2E Testing for Dispute Resolution Workflows
**Label:** `testing`, `qa`
**Complexity:** 150 points
**Description:**
Expand the test suite to cover complex multi-party dispute scenarios, including arbitrator intervention and split resolutions.
**Tasks:**
- [ ] Create E2E tests for the full dispute lifecycle.
- [ ] Mock Stellar network responses for various scenarios.
- [ ] Verify database consistency after resolution.

### 10. [Scalability] Implement BullMQ for Asynchronous Stellar Transaction Submission
**Label:** `scalability`, `performance`
**Complexity:** 200 points
**Description:**
Offload transaction signing and submission to a background worker using BullMQ. This ensures that the main API remains responsive during network congestion.
**Tasks:**
- [ ] Set up a BullMQ queue for Stellar transactions.
- [ ] Implement a background processor for the queue.
- [ ] Add retry logic and error tracking for failed submissions.
