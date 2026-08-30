import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { StellarEventListenerService } from '../../src/modules/stellar/services/stellar-event-listener.service';
import {
  StellarEvent,
  StellarEventType,
} from '../../src/modules/stellar/entities/stellar-event.entity';
import {
  Escrow,
  EscrowStatus,
} from '../../src/modules/escrow/entities/escrow.entity';
import { Condition } from '../../src/modules/escrow/entities/condition.entity';
import {
  EscrowEvent,
  EscrowEventType,
} from '../../src/modules/escrow/entities/escrow-event.entity';
import {
  Party,
  PartyRole,
} from '../../src/modules/escrow/entities/party.entity';
import { User } from '../../src/modules/user/entities/user.entity';
import { SorobanClientService } from '../../src/services/stellar/soroban-client.service';
import { ConfigService } from '@nestjs/config';
import { ConsistencyCheckerService } from '../../src/modules/admin/services/consistency-checker.service';
import { EscrowGateway } from '../../src/gateways/escrow.gateway';
import { NotificationService } from '../../src/notifications/notifications.service';

/**
 * Integration test: simulates the full milestone release flow.
 *
 * Uses a real in-memory SQLite database with actual TypeORM entities,
 * the real StellarEventListenerService, and mocked external dependencies
 * (SorobanClient, EscrowGateway, NotificationService).
 *
 * Flow:
 * 1. Seed escrow + conditions + parties in DB
 * 2. Simulate a MILESTONE_RELEASED event from the Stellar network
 * 3. Verify DB state: condition marked released, escrow releasedAmount updated
 * 4. Verify WebSocket broadcast was called
 * 5. Verify notifications were created for buyer and seller
 * 6. Verify audit trail entry in escrow_events
 * 7. Re-process same event → verify idempotent (no duplicate changes)
 */
describe('Milestone Release Integration (e2e-style)', () => {
  let moduleRef: TestingModule;
  let service: StellarEventListenerService;
  let escrowRepo: Repository<Escrow>;
  let conditionRepo: Repository<Condition>;
  let escrowEventRepo: Repository<EscrowEvent>;
  let partyRepo: Repository<Party>;
  let stellarEventRepo: Repository<StellarEvent>;
  let escrowGateway: { broadcastMilestoneReleased: jest.Mock };
  let notificationService: { handleEscrowEvent: jest.Mock };

  const escrowId = 'test-escrow-id';

  beforeEach(async () => {
    escrowGateway = { broadcastMilestoneReleased: jest.fn() };
    notificationService = {
      handleEscrowEvent: jest.fn().mockResolvedValue(undefined),
    };

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Escrow, Condition, EscrowEvent, Party, StellarEvent, User],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([
          StellarEvent,
          Escrow,
          Condition,
          EscrowEvent,
          Party,
        ]),
      ],
      providers: [
        StellarEventListenerService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(0) },
        },
        {
          provide: SorobanClientService,
          useValue: {
            getContractId: jest.fn().mockReturnValue('test-contract'),
            getRpc: jest.fn().mockReturnValue({
              getLatestLedger: jest.fn().mockResolvedValue({ sequence: 100 }),
              getEvents: jest.fn().mockResolvedValue({ events: [] }),
            }),
          },
        },
        {
          provide: ConsistencyCheckerService,
          useValue: { checkConsistency: jest.fn().mockResolvedValue({}) },
        },
        { provide: EscrowGateway, useValue: escrowGateway },
        { provide: NotificationService, useValue: notificationService },
      ],
    }).compile();

    // Create tables manually to avoid SQLite AUTOINCREMENT incompatibility
    // with TypeORM's @Generated('increment') on non-PK bigint columns
    const dataSource = moduleRef.get<DataSource>(DataSource);
    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.query(`
      CREATE TABLE users (
        id VARCHAR PRIMARY KEY,
        walletAddress VARCHAR UNIQUE,
        nonce VARCHAR,
        isActive BOOLEAN DEFAULT 1,
        role TEXT DEFAULT 'USER',
        displayName VARCHAR(100),
        email VARCHAR(255) UNIQUE,
        emailVerified BOOLEAN DEFAULT 0,
        avatarUrl VARCHAR(500),
        bio TEXT,
        preferredAsset VARCHAR(20) DEFAULT 'XLM',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE escrows (
        id VARCHAR PRIMARY KEY,
        title VARCHAR NOT NULL,
        description TEXT,
        amount DECIMAL(18,7) NOT NULL,
        releasedAmount DECIMAL(18,7) DEFAULT 0,
        asset_code VARCHAR DEFAULT 'XLM',
        asset_issuer VARCHAR,
        status VARCHAR DEFAULT 'pending',
        type VARCHAR DEFAULT 'standard',
        creatorId VARCHAR NOT NULL,
        releaseTransactionHash VARCHAR,
        stellarTxHash VARCHAR,
        fundedAt DATETIME,
        isReleased BOOLEAN DEFAULT 0,
        expiresAt DATETIME,
        expirationNotifiedAt DATETIME,
        isActive BOOLEAN DEFAULT 1,
        metadataHash VARCHAR,
        ipfs_cid VARCHAR,
        ipfs_metadata_hash VARCHAR,
        ipfs_version INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE escrow_conditions (
        id VARCHAR PRIMARY KEY,
        escrowId VARCHAR NOT NULL,
        description TEXT NOT NULL,
        type VARCHAR DEFAULT 'manual',
        isFulfilled BOOLEAN DEFAULT 0,
        fulfilledAt DATETIME,
        fulfilledByUserId VARCHAR,
        fulfillmentNotes TEXT,
        fulfillmentEvidence TEXT,
        isMet BOOLEAN DEFAULT 0,
        metAt DATETIME,
        metByUserId VARCHAR,
        metadata TEXT,
        amount DECIMAL(18,7),
        proposedAmount DECIMAL(18,7),
        proposedDescription TEXT,
        proposedByUserId VARCHAR,
        isReleased BOOLEAN DEFAULT 0,
        releasedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (escrowId) REFERENCES escrows(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE escrow_events (
        id VARCHAR PRIMARY KEY,
        escrowId VARCHAR NOT NULL,
        eventType VARCHAR NOT NULL,
        actorId VARCHAR,
        data TEXT,
        ipAddress VARCHAR,
        cursor INTEGER DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (escrowId) REFERENCES escrows(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE escrow_parties (
        id VARCHAR PRIMARY KEY,
        escrowId VARCHAR NOT NULL,
        userId VARCHAR NOT NULL,
        role VARCHAR NOT NULL,
        status VARCHAR DEFAULT 'pending',
        respondedAt DATETIME,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (escrowId) REFERENCES escrows(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE stellar_events (
        id VARCHAR PRIMARY KEY,
        txHash VARCHAR(64) NOT NULL,
        eventIndex INTEGER NOT NULL,
        eventType VARCHAR NOT NULL,
        escrowId VARCHAR,
        ledger INTEGER NOT NULL,
        timestamp DATETIME NOT NULL,
        rawPayload TEXT NOT NULL,
        extractedFields TEXT,
        amount DECIMAL(18,7),
        asset_code VARCHAR,
        asset_issuer VARCHAR,
        milestoneIndex INTEGER,
        fromAddress VARCHAR,
        toAddress VARCHAR,
        reason TEXT,
        cursor BIGINT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(txHash, eventIndex)
      )
    `);
    await queryRunner.release();

    service = moduleRef.get(StellarEventListenerService);
    escrowRepo = moduleRef.get(getRepositoryToken(Escrow));
    conditionRepo = moduleRef.get(getRepositoryToken(Condition));
    escrowEventRepo = moduleRef.get(getRepositoryToken(EscrowEvent));
    partyRepo = moduleRef.get(getRepositoryToken(Party));
    stellarEventRepo = moduleRef.get(getRepositoryToken(StellarEvent));

    // Initialize internal state
    (service as any).server = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 100 }),
      getEvents: jest.fn().mockResolvedValue({ events: [] }),
    };
    (service as any).contractId = 'test-contract';

    // Seed test data
    await seedTestData();
  });

  afterEach(async () => {
    if (moduleRef) await moduleRef.close();
  });

  async function seedTestData() {
    // Create escrow
    const escrow = escrowRepo.create({
      id: escrowId,
      title: 'Integration Test Escrow',
      amount: 500,
      releasedAmount: 0,
      assetCode: 'XLM',
      status: EscrowStatus.ACTIVE,
      creatorId: 'creator-user-id',
      isActive: true,
    });
    await escrowRepo.save(escrow);

    // Create 3 milestone conditions
    for (let i = 0; i < 3; i++) {
      const condition = conditionRepo.create({
        escrowId,
        description: `Milestone ${i + 1}`,
        amount: i === 0 ? 100 : i === 1 ? 200 : 200,
        isReleased: false,
      });
      await conditionRepo.save(condition);
    }

    // Create parties
    const buyer = partyRepo.create({
      escrowId,
      userId: 'buyer-user-id',
      role: PartyRole.BUYER,
      status: 'accepted' as any,
      respondedAt: new Date(),
    });
    const seller = partyRepo.create({
      escrowId,
      userId: 'seller-user-id',
      role: PartyRole.SELLER,
      status: 'accepted' as any,
      respondedAt: new Date(),
    });
    await partyRepo.save([buyer, seller]);
  }

  function createMilestoneEvent(
    milestoneIndex: number,
    amount: number,
    txHash: string,
  ): StellarEvent {
    return stellarEventRepo.create({
      txHash,
      eventIndex: 0,
      eventType: StellarEventType.MILESTONE_RELEASED,
      escrowId,
      ledger: 42,
      timestamp: new Date(),
      rawPayload: {},
      milestoneIndex,
      amount,
      cursor: '42000',
    });
  }

  it('should process milestone release: update DB, emit WS, create notifications', async () => {
    const event = createMilestoneEvent(0, 100, 'tx-milestone-1');

    // Call the handler directly
    await (service as any).handleMilestoneReleased(event);

    // 1. Verify condition is marked released
    const conditions = await conditionRepo.find({
      where: { escrowId },
      order: { createdAt: 'ASC' },
    });
    expect(conditions[0].isReleased).toBe(true);
    expect(conditions[0].releasedAt).toBeDefined();
    expect(conditions[0].metadata).toEqual(
      expect.objectContaining({
        releasedTxHash: 'tx-milestone-1',
        milestoneIndex: 0,
      }),
    );
    // Other conditions should NOT be released
    expect(conditions[1].isReleased).toBe(false);
    expect(conditions[2].isReleased).toBe(false);

    // 2. Verify escrow releasedAmount updated
    const escrow = await escrowRepo.findOne({ where: { id: escrowId } });
    expect(escrow!.releasedAmount).toBe(100);
    expect(escrow!.stellarTxHash).toBe('tx-milestone-1');

    // 3. Verify audit trail entry
    const escrowEvents = await escrowEventRepo.find({
      where: { escrowId, eventType: EscrowEventType.MILESTONE_RELEASED },
    });
    expect(escrowEvents.length).toBe(1);
    expect(escrowEvents[0].data).toEqual(
      expect.objectContaining({
        milestoneIndex: 0,
        amount: 100,
        txHash: 'tx-milestone-1',
      }),
    );
    expect(escrowEvents[0].actorId).toBe('stellar-network');

    // 4. Verify WebSocket broadcast
    expect(escrowGateway.broadcastMilestoneReleased).toHaveBeenCalledWith(
      escrowId,
      expect.objectContaining({
        milestoneIndex: 0,
        amount: 100,
        txHash: 'tx-milestone-1',
      }),
    );

    // 5. Verify notifications for buyer and seller
    expect(notificationService.handleEscrowEvent).toHaveBeenCalledTimes(2);
    expect(notificationService.handleEscrowEvent).toHaveBeenCalledWith(
      'buyer-user-id',
      'MILESTONE_RELEASED',
      expect.objectContaining({ escrowId }),
    );
    expect(notificationService.handleEscrowEvent).toHaveBeenCalledWith(
      'seller-user-id',
      'MILESTONE_RELEASED',
      expect.objectContaining({ escrowId }),
    );
  });

  it('should accumulate releasedAmount across multiple milestone releases', async () => {
    // Release milestone 0 (100)
    const event1 = createMilestoneEvent(0, 100, 'tx-ms-1');
    await (service as any).handleMilestoneReleased(event1);

    // Release milestone 1 (200)
    const event2 = createMilestoneEvent(1, 200, 'tx-ms-2');
    await (service as any).handleMilestoneReleased(event2);

    const escrow = await escrowRepo.findOne({ where: { id: escrowId } });
    expect(escrow!.releasedAmount).toBe(300); // 100 + 200

    const conditions = await conditionRepo.find({
      where: { escrowId },
      order: { createdAt: 'ASC' },
    });
    expect(conditions[0].isReleased).toBe(true);
    expect(conditions[1].isReleased).toBe(true);
    expect(conditions[2].isReleased).toBe(false);
  });

  it('should be idempotent — re-processing same event does not double-count', async () => {
    const event = createMilestoneEvent(0, 100, 'tx-idempotent');

    // Process twice
    await (service as any).handleMilestoneReleased(event);
    await (service as any).handleMilestoneReleased(event);

    const escrow = await escrowRepo.findOne({ where: { id: escrowId } });
    expect(escrow!.releasedAmount).toBe(100); // NOT 200

    // Only one audit trail entry should exist
    const escrowEvents = await escrowEventRepo.find({
      where: { escrowId, eventType: EscrowEventType.MILESTONE_RELEASED },
    });
    expect(escrowEvents.length).toBe(1);
  });

  it('should handle escrow not found gracefully', async () => {
    const event = createMilestoneEvent(0, 100, 'tx-orphan');
    event.escrowId = 'non-existent-escrow';

    // Should not throw
    await (service as any).handleMilestoneReleased(event);

    // No conditions should be modified
    const conditions = await conditionRepo.find({ where: { escrowId } });
    expect(conditions.every((c) => !c.isReleased)).toBe(true);
  });
});
