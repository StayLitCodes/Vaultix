# Real escrow smoke flow

The smoke flow exercises the running API and a local Soroban network. It signs
the authentication challenge with deterministic test-only Stellar keys, creates
an escrow, accepts the seller invitation, funds it, waits for Horizon finality,
and verifies the API reaches the expected `active` status.

Run it against a configured local backend with:

```bash
cd apps/backend
npm ci
SMOKE_API_URL=http://127.0.0.1:3001 \
HORIZON_URL=http://127.0.0.1:8000 \
STELLAR_RPC_URL=http://127.0.0.1:8000/rpc \
SMOKE_EXPECTED_STATUS=active \
npm run test:smoke
```

`SMOKE_BUYER_SECRET` and `SMOKE_SELLER_SECRET` may override the deterministic
test keys. Never use these defaults or any smoke key on a public network.

The protocol assertion is intentional. To prove the check is required, run the
same command with `SMOKE_EXPECTED_STATUS=completed`; it must exit non-zero with
`protocol mismatch`. Restore `SMOKE_EXPECTED_STATUS=active` for the passing run.

The CI job starts and stops the local Soroban container, builds and initializes
the contract, starts the real backend, runs this flow, and uploads the backend
log and SQLite database on failure. Frontend unit tests remain separate from
the fast mocked Playwright regressions in `frontend-ci.yml`.