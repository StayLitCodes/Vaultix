# Stellar Chain / DB Consistency Repair Service

## Problem

The Vaultix database and the Stellar ledger can drift out of sync if:
- A transaction is submitted but the app crashes before the DB is updated.
- A network partition causes the backend to miss a Stellar event.

## Design

### RepairService

A scheduled NestJS service that runs every **10 minutes** and reconciles
escrow records between the DB and the Stellar ledger.

```ts
@Injectable()
export class StellarRepairService {
  constructor(
    private readonly escrowRepo: Repository<Escrow>,
    private readonly stellarService: StellarService,
  ) {}

  @Cron('*/10 * * * *')
  async reconcile() {
    const pending = await this.escrowRepo.find({ where: { status: 'pending' } });
    for (const escrow of pending) {
      const onChain = await this.stellarService.getEscrowState(escrow.stellarId);
      if (onChain && onChain.status !== escrow.status) {
        await this.escrowRepo.update(escrow.id, { status: onChain.status });
      }
    }
  }
}
```

### Idempotency

Each repair run is idempotent — re-running it on an already-reconciled
record is a no-op.

### Alerting

If more than **50** records are found out-of-sync in a single run, emit a
`repair.drift_alert` event for ops notification.