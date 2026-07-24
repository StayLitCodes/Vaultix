import { DataSource } from 'typeorm';
import { AddEscrowQueryPerformanceIndexes } from './1780700000000-AddEscrowQueryPerformanceIndexes';

describe('AddEscrowQueryPerformanceIndexes migration', () => {
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [],
      synchronize: false,
    });

    await dataSource.initialize();

    await dataSource.query(`
      CREATE TABLE escrows (
        id TEXT PRIMARY KEY,
        creatorId TEXT NOT NULL,
        status TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        expiresAt DATETIME,
        updatedAt DATETIME
      )
    `);

    await dataSource.query(`
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        walletAddress TEXT NOT NULL
      )
    `);

    await dataSource.query(`
      CREATE TABLE escrow_parties (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        escrowId TEXT NOT NULL
      )
    `);

    await dataSource.query(`
      CREATE TABLE escrow_events (
        id TEXT PRIMARY KEY,
        escrowId TEXT NOT NULL,
        createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
  });

  afterEach(async () => {
    await dataSource.destroy();
  });

  it('creates indexes that are used by common escrow queries', async () => {
    const runner = dataSource.createQueryRunner();
    const migration = new AddEscrowQueryPerformanceIndexes();

    await migration.up(runner);
    await runner.release();

    const escrowIndexes = await dataSource.query(`PRAGMA index_list('escrows')`);
    const userIndexes = await dataSource.query(`PRAGMA index_list('users')`);
    const eventIndexes = await dataSource.query(`PRAGMA index_list('escrow_events')`);

    expect(escrowIndexes.some((index: { name: string }) => index.name === 'idx_escrows_status')).toBe(true);
    expect(escrowIndexes.some((index: { name: string }) => index.name === 'idx_escrows_creator_status')).toBe(true);
    expect(escrowIndexes.some((index: { name: string }) => index.name === 'idx_escrows_created_at')).toBe(true);
    expect(escrowIndexes.some((index: { name: string }) => index.name === 'idx_escrows_expires_at')).toBe(true);
    expect(userIndexes.some((index: { name: string }) => index.name === 'idx_users_wallet_address')).toBe(true);
    expect(eventIndexes.some((index: { name: string }) => index.name === 'idx_escrow_events_escrow_id')).toBe(true);

    const statusPlan = await dataSource.query(
      `EXPLAIN QUERY PLAN SELECT * FROM escrows WHERE status = 'active'`,
    );
    const creatorStatusPlan = await dataSource.query(
      `EXPLAIN QUERY PLAN SELECT * FROM escrows WHERE creatorId = 'user-1' AND status = 'active'`,
    );
    const createdAtPlan = await dataSource.query(
      `EXPLAIN QUERY PLAN SELECT * FROM escrows WHERE createdAt >= '2026-01-01'`,
    );
    const expiresAtPlan = await dataSource.query(
      `EXPLAIN QUERY PLAN SELECT * FROM escrows WHERE expiresAt <= '2026-12-31'`,
    );
    const walletPlan = await dataSource.query(
      `EXPLAIN QUERY PLAN SELECT * FROM users WHERE walletAddress = 'GABC123'`,
    );
    const eventPlan = await dataSource.query(
      `EXPLAIN QUERY PLAN SELECT * FROM escrow_events WHERE escrowId = 'escrow-1'`,
    );

    const combinedPlan = [
      ...statusPlan,
      ...creatorStatusPlan,
      ...createdAtPlan,
      ...expiresAtPlan,
      ...walletPlan,
      ...eventPlan,
    ]
      .map((row: { detail: string }) => row.detail)
      .join('\n');

    expect(combinedPlan).toContain('idx_escrows_status');
    expect(combinedPlan).toContain('idx_escrows_creator_status');
    expect(combinedPlan).toContain('idx_escrows_created_at');
    expect(combinedPlan).toContain('idx_escrows_expires_at');
    expect(combinedPlan).toContain('idx_users_wallet_address');
    expect(combinedPlan).toContain('idx_escrow_events_escrow_id');
  });
});
