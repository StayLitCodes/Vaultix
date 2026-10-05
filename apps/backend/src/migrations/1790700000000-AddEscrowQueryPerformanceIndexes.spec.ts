import { DataSource, QueryRunner } from 'typeorm';
import { AddEscrowQueryPerformanceIndexes1790700000000 as SqliteMigration } from './1790700000000-AddEscrowQueryPerformanceIndexes';
import { AddEscrowQueryPerformanceIndexes1790700000000 as PostgresMigration } from '../migrations-postgres/1790700000000-AddEscrowQueryPerformanceIndexes';

describe('AddEscrowQueryPerformanceIndexes migration', () => {
  let dataSource: DataSource | undefined;
  let queryRunner: QueryRunner | undefined;

  beforeEach(async () => {
    dataSource = new DataSource({
      type: 'sqlite',
      database: ':memory:',
      entities: [],
      synchronize: false,
    });
    await dataSource.initialize();
    const runner = dataSource.createQueryRunner();
    queryRunner = runner;

    await runner.query(
      'CREATE TABLE "escrows" ("id" varchar PRIMARY KEY, "creatorId" varchar NOT NULL, "status" varchar NOT NULL, "createdAt" datetime NOT NULL, "expiresAt" datetime)',
    );
    await runner.query(
      'CREATE INDEX "idx_escrows_status" ON "escrows" ("status")',
    );
    await runner.query(
      'CREATE INDEX "idx_escrows_creator_status_created" ON "escrows" ("creatorId", "status", "createdAt")',
    );
    await runner.query(
      'CREATE INDEX "idx_escrows_created_at" ON "escrows" ("createdAt")',
    );
    await runner.query(
      'CREATE INDEX "idx_escrows_expires_at" ON "escrows" ("expiresAt")',
    );
    await runner.query(
      'CREATE TABLE "users" ("id" varchar PRIMARY KEY, "walletAddress" varchar NOT NULL UNIQUE)',
    );
    await runner.query(
      'CREATE TABLE "escrow_parties" ("id" varchar PRIMARY KEY, "userId" varchar NOT NULL, "role" varchar NOT NULL, "escrowId" varchar NOT NULL)',
    );
    await runner.query(
      'CREATE TABLE "escrow_events" ("id" varchar PRIMARY KEY, "escrowId" varchar NOT NULL, "createdAt" datetime NOT NULL)',
    );
  });

  afterEach(async () => {
    if (queryRunner && !queryRunner.isReleased) {
      await queryRunner.release();
    }
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('adds the missing party and event indexes and uses them for lookups', async () => {
    const runner = queryRunner!;
    const migration = new SqliteMigration();
    await migration.up(runner);
    await migration.up(runner);

    const partyIndexes = await runner.query(
      'PRAGMA index_list("escrow_parties")',
    );
    const eventIndexes = await runner.query(
      'PRAGMA index_list("escrow_events")',
    );

    expect(partyIndexes.map((index: { name: string }) => index.name)).toContain(
      'idx_escrow_parties_user_role',
    );
    expect(eventIndexes.map((index: { name: string }) => index.name)).toContain(
      'idx_escrow_events_escrow_id',
    );

    const partyPlan = await runner.query(
      'EXPLAIN QUERY PLAN SELECT * FROM "escrow_parties" WHERE "userId" = ?',
      ['user-1'],
    );
    const eventPlan = await runner.query(
      'EXPLAIN QUERY PLAN SELECT * FROM "escrow_events" WHERE "escrowId" = ?',
      ['escrow-1'],
    );

    expect(
      partyPlan.map((row: { detail: string }) => row.detail).join(' '),
    ).toContain('idx_escrow_parties_user_role');
    expect(
      eventPlan.map((row: { detail: string }) => row.detail).join(' '),
    ).toContain('idx_escrow_events_escrow_id');

    await migration.down(runner);
    const remainingEvents = await runner.query(
      'PRAGMA index_list("escrow_events")',
    );
    const remainingParties = await runner.query(
      'PRAGMA index_list("escrow_parties")',
    );
    expect(
      remainingEvents.map((index: { name: string }) => index.name),
    ).not.toContain('idx_escrow_events_escrow_id');
    expect(
      remainingParties.map((index: { name: string }) => index.name),
    ).not.toContain('idx_escrow_parties_user_role');
  });
});

const postgresTestUrl = process.env.POSTGRES_TEST_URL;
const describePostgres = postgresTestUrl ? describe : describe.skip;

describePostgres('PostgreSQL escrow query plans', () => {
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      url: postgresTestUrl,
      entities: [],
      synchronize: false,
    });
    await dataSource.initialize();
  });

  beforeEach(async () => {
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    await queryRunner.query(
      'CREATE TEMP TABLE "escrows" ("id" text PRIMARY KEY, "creatorId" text NOT NULL, "status" text NOT NULL, "createdAt" timestamptz NOT NULL, "expiresAt" timestamptz, "isActive" boolean NOT NULL)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_escrows_status" ON "escrows" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_escrows_creator_status_created" ON "escrows" ("creatorId", "status", "createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_escrows_created_at" ON "escrows" ("createdAt")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_escrows_expires_at" ON "escrows" ("expiresAt")',
    );
    await queryRunner.query(
      'CREATE TEMP TABLE "users" ("id" text PRIMARY KEY, "walletAddress" text NOT NULL UNIQUE)',
    );
    await queryRunner.query(
      'CREATE TEMP TABLE "escrow_parties" ("id" bigint GENERATED ALWAYS AS IDENTITY, "userId" text NOT NULL, "role" text NOT NULL, "escrowId" text NOT NULL)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_escrow_parties_user_role" ON "escrow_parties" ("userId", "role")',
    );
    await queryRunner.query(
      'CREATE TEMP TABLE "escrow_events" ("id" bigint GENERATED ALWAYS AS IDENTITY, "escrowId" text NOT NULL, "createdAt" timestamptz NOT NULL)',
    );
    await queryRunner.query(
      "INSERT INTO \"escrows\" SELECT i::text, 'user-' || (i % 1000), CASE WHEN i % 1000 = 0 THEN 'disputed' ELSE 'active' END, NOW() - (i * INTERVAL '1 second'), CASE WHEN i % 1000 = 997 THEN NOW() - INTERVAL '1 day' ELSE NOW() + INTERVAL '1 day' END, true FROM generate_series(1, 50000) AS i",
    );
    await queryRunner.query(
      'INSERT INTO "users" SELECT i::text, \'wallet-\' || i FROM generate_series(1, 10000) AS i',
    );
    await queryRunner.query(
      'INSERT INTO "escrow_parties" ("userId", "role", "escrowId") SELECT \'user-\' || (i % 1000), \'buyer\', \'escrow-\' || (i % 1000) FROM generate_series(1, 50000) AS i',
    );
    await queryRunner.query(
      'INSERT INTO "escrow_events" ("escrowId", "createdAt") SELECT \'escrow-\' || (i % 1000), NOW() - (i * INTERVAL \'1 second\') FROM generate_series(1, 50000) AS i',
    );

    await new PostgresMigration().up(queryRunner);
    await queryRunner.query('ANALYZE "escrows"');
    await queryRunner.query('ANALYZE "users"');
    await queryRunner.query('ANALYZE "escrow_parties"');
    await queryRunner.query('ANALYZE "escrow_events"');
  });

  afterEach(async () => {
    await queryRunner.rollbackTransaction();
    await queryRunner.release();
  });

  afterAll(async () => {
    await dataSource?.destroy();
  });

  it('uses indexes for the common escrow, party, wallet, and event lookups', async () => {
    const queries: Array<[string, string]> = [
      [
        'idx_escrows_status',
        `SELECT * FROM "escrows" WHERE "status" = 'disputed'`,
      ],
      [
        'idx_escrows_creator_status_created',
        `SELECT * FROM "escrows" WHERE "creatorId" = 'user-1' AND "status" = 'active'`,
      ],
      [
        'idx_escrows_created_at',
        `SELECT * FROM "escrows" WHERE "createdAt" >= NOW() - INTERVAL '30 seconds'`,
      ],
      [
        'idx_escrows_expires_at',
        `SELECT * FROM "escrows" WHERE "status" = 'active' AND "expiresAt" < NOW()`,
      ],
      [
        'users_walletAddress_key',
        `SELECT * FROM "users" WHERE "walletAddress" = 'wallet-1'`,
      ],
      [
        'idx_escrow_parties_user_role',
        `SELECT * FROM "escrow_parties" WHERE "userId" = 'user-1' AND "role" = 'buyer'`,
      ],
      [
        'idx_escrow_events_escrow_id',
        `SELECT * FROM "escrow_events" WHERE "escrowId" = 'escrow-1'`,
      ],
    ];

    for (const [indexName, sql] of queries) {
      const result = await queryRunner.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${sql}`,
      );
      const plan = result
        .map((row: Record<string, string>) => Object.values(row).join(' '))
        .join('\n');

      expect(plan).toContain(indexName);
    }
  });
});
