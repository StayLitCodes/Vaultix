import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotificationService } from '../../src/notifications/notifications.service';
import { Notification } from '../../src/notifications/entities/notification.entity';
import { NotificationEventType } from '../../src/notifications/enums/notification-event.enum';
import { PreferenceService } from '../../src/notifications/preference.service';
import { NotificationPreference } from '../../src/notifications/entities/notification-preference.entity';
import { User } from '../../src/modules/user/entities/user.entity';
import { EscrowService } from '../../src/modules/escrow/services/escrow.service';
import {
  EscrowStatus,
  EscrowType,
} from '../../src/modules/escrow/entities/escrow.entity';
import {
  PartyRole,
  PartyStatus,
} from '../../src/modules/escrow/entities/party.entity';
import { ConditionType } from '../../src/modules/escrow/entities/condition.entity';
import { UserRole } from '../../src/modules/user/entities/user.entity';
import { NotificationChannel } from '../../src/notifications/enums/notification-event.enum';
import { EmailSender } from '../../src/notifications/senders/email.sender';
import { WebhookSender } from '../../src/notifications/senders/webhook.sender';

/**
 * Integration test: notification deduplication with idempotency keys
 *
 * Tests that:
 * 1. Fund escrow creates exactly 1 notification per party
 * 2. Complete milestone creates exactly 1 notification
 * 3. File dispute creates exactly 1 notification to counterparty + admin
 * 4. Duplicate calls with same idempotency key are prevented
 * 5. Different events with different keys create separate notifications
 */
describe('Notification Deduplication (e2e-style)', () => {
  let moduleRef: TestingModule;
  let notificationService: NotificationService;
  let notificationRepo: Repository<Notification>;
  let preferenceRepo: Repository<NotificationPreference>;
  let userRepo: Repository<User>;
  let escrowService: EscrowService;
  let escrowRepo: any;
  let partyRepo: any;
  let conditionRepo: any;
  let escrowEventRepo: any;
  let disputeRepo: any;
  let assetRepo: any;
  let stellarIntegration: any;
  let webhookService: any;
  let ipfsService: any;

  const testUserId = 'test-user-id';
  const testEscrowId = 'test-escrow-id';

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [Notification, NotificationPreference, User],
          synchronize: false,
        }),
        TypeOrmModule.forFeature([Notification, NotificationPreference, User]),
      ],
      providers: [
        NotificationService,
        PreferenceService,
        { provide: EmailSender, useValue: { send: jest.fn() } },
        { provide: WebhookSender, useValue: { send: jest.fn() } },
      ],
    }).compile();

    // Create tables manually
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
      CREATE TABLE notification_preference (
        id VARCHAR PRIMARY KEY,
        userId VARCHAR NOT NULL,
        channel VARCHAR NOT NULL,
        enabled BOOLEAN DEFAULT 1,
        eventTypes TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE notification (
        id VARCHAR PRIMARY KEY,
        userId VARCHAR NOT NULL,
        escrowId VARCHAR,
        eventType VARCHAR NOT NULL,
        payload TEXT NOT NULL,
        status VARCHAR DEFAULT 'PENDING',
        retryCount INTEGER DEFAULT 0,
        readAt DATETIME,
        idempotencyKey VARCHAR,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX idx_notification_idempotency_key ON notification(idempotencyKey) WHERE idempotencyKey IS NOT NULL
    `);
    await queryRunner.release();

    notificationService = moduleRef.get(NotificationService);
    notificationRepo = moduleRef.get(getRepositoryToken(Notification));
    preferenceRepo = moduleRef.get(getRepositoryToken(NotificationPreference));
    userRepo = moduleRef.get(getRepositoryToken(User));

    // Seed test data
    await seedTestData();
    createEscrowService();
  });

  afterEach(async () => {
    if (moduleRef) await moduleRef.close();
  });

  async function seedTestData() {
    // Create test user
    const user = userRepo.create({
      id: testUserId,
      walletAddress: 'test-wallet',
      email: 'test@example.com',
    });
    await userRepo.save(user);

    // Create notification preference for email
    const preference = preferenceRepo.create({
      id: 'pref-1',
      userId: testUserId,
      channel: NotificationChannel.EMAIL,
      enabled: true,
      eventTypes: [
        NotificationEventType.ESCROW_FUNDED,
        NotificationEventType.MILESTONE_RELEASED,
        NotificationEventType.DISPUTE_RAISED,
        NotificationEventType.DISPUTE_RESOLVED,
      ],
    });
    await preferenceRepo.save(preference);
  }

  function createEscrowService() {
    escrowRepo = {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    };
    partyRepo = { findOne: jest.fn(), find: jest.fn(), save: jest.fn() };
    conditionRepo = { save: jest.fn() };
    escrowEventRepo = { create: jest.fn((value) => value), save: jest.fn() };
    disputeRepo = {
      findOne: jest.fn(),
      create: jest.fn((value) => value),
      save: jest.fn(),
    };
    assetRepo = {};
    stellarIntegration = { fundOnChainEscrow: jest.fn() };
    webhookService = { dispatchEvent: jest.fn() };
    ipfsService = {};

    escrowService = new EscrowService(
      escrowRepo,
      partyRepo,
      conditionRepo,
      escrowEventRepo,
      disputeRepo,
      userRepo,
      assetRepo,
      stellarIntegration,
      webhookService,
      ipfsService,
      notificationService,
    );
  }

  function generateIdempotencyKey(
    eventType: NotificationEventType,
    escrowId: string,
    userId: string,
    actorId = 'actor-user-id',
  ): string {
    const timestampBucket = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute bucket
    return `${eventType}:${escrowId}:${actorId}:${userId}:${timestampBucket}`;
  }

  async function addUserPreference(
    userId: string,
    role: UserRole = UserRole.USER,
    eventTypes: NotificationEventType[] = [
      NotificationEventType.ESCROW_FUNDED,
      NotificationEventType.MILESTONE_RELEASED,
      NotificationEventType.DISPUTE_RAISED,
    ],
  ) {
    await userRepo.save(
      userRepo.create({
        id: userId,
        walletAddress: `${userId}-wallet`,
        email: `${userId}@example.com`,
        role,
      }),
    );
    await preferenceRepo.save(
      preferenceRepo.create({
        id: `pref-${userId}`,
        userId,
        channel: NotificationChannel.EMAIL,
        enabled: true,
        eventTypes,
      }),
    );
  }

  it('funds an escrow and creates exactly one notification per party', async () => {
    await addUserPreference('seller-id');
    const escrow = {
      id: 'fund-escrow',
      title: 'Fund escrow',
      amount: 100,
      assetCode: 'XLM',
      creatorId: testUserId,
      status: EscrowStatus.PENDING,
      stellarTxHash: undefined,
      parties: [
        {
          userId: testUserId,
          role: PartyRole.BUYER,
          status: PartyStatus.ACCEPTED,
        },
        {
          userId: 'seller-id',
          role: PartyRole.SELLER,
          status: PartyStatus.ACCEPTED,
        },
      ],
      conditions: [],
    } as any;
    escrowRepo.findOne.mockResolvedValue(escrow);
    stellarIntegration.fundOnChainEscrow.mockResolvedValue('fund-tx');

    await escrowService.fund(
      'fund-escrow',
      { amount: 100 } as any,
      testUserId,
      'buyer-wallet',
    );

    const notifications = await notificationRepo.find({
      where: {
        escrowId: 'fund-escrow',
        eventType: NotificationEventType.ESCROW_FUNDED,
      },
    });
    expect(notifications).toHaveLength(2);
    expect(
      notifications.map((notification) => notification.userId).sort(),
    ).toEqual(['seller-id', testUserId]);
  });

  it('releases a milestone and creates exactly one notification', async () => {
    await addUserPreference('seller-id');
    const escrow = {
      id: 'milestone-escrow',
      title: 'Milestone escrow',
      amount: 100,
      type: EscrowType.MILESTONE,
      creatorId: testUserId,
      status: EscrowStatus.ACTIVE,
      releasedAmount: 0,
      isReleased: false,
      expiresAt: undefined,
      parties: [
        { userId: testUserId, role: PartyRole.BUYER },
        { userId: 'seller-id', role: PartyRole.SELLER },
      ],
      conditions: [
        {
          id: 'condition-1',
          type: ConditionType.MANUAL,
          isMet: true,
          isReleased: false,
          amount: 100,
        },
      ],
    } as any;
    escrowRepo.findOne.mockResolvedValue(escrow);

    await escrowService.releaseMilestone(
      'milestone-escrow',
      'condition-1',
      testUserId,
    );

    const notifications = await notificationRepo.find({
      where: {
        escrowId: 'milestone-escrow',
        eventType: NotificationEventType.MILESTONE_RELEASED,
      },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe('seller-id');
  });

  it('files a dispute and creates exactly one notification for the counterparty and admin', async () => {
    await addUserPreference('seller-id');
    await addUserPreference('admin-id', UserRole.ADMIN);
    const escrow = {
      id: 'dispute-escrow',
      title: 'Dispute escrow',
      creatorId: testUserId,
      status: EscrowStatus.ACTIVE,
      parties: [{ userId: 'seller-id', role: PartyRole.SELLER }],
    } as any;
    escrowRepo.findOne.mockResolvedValue(escrow);
    disputeRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValue({ id: 'dispute-1' });
    disputeRepo.save.mockResolvedValue({ id: 'dispute-1' });
    await escrowService.fileDispute('dispute-escrow', testUserId, {
      reason: 'Issue',
    } as any);

    const notifications = await notificationRepo.find({
      where: {
        escrowId: 'dispute-escrow',
        eventType: NotificationEventType.DISPUTE_RAISED,
      },
    });
    expect(notifications).toHaveLength(2);
    expect(
      notifications.map((notification) => notification.userId).sort(),
    ).toEqual(['admin-id', 'seller-id']);
  });

  it('should create exactly 1 notification for fund escrow event', async () => {
    const idempotencyKey = generateIdempotencyKey(
      NotificationEventType.ESCROW_FUNDED,
      testEscrowId,
      testUserId,
    );

    // Call handleEscrowEvent twice with same idempotency key
    await notificationService.handleEscrowEvent(
      testUserId,
      NotificationEventType.ESCROW_FUNDED,
      {
        escrowId: testEscrowId,
        escrowTitle: 'Test Escrow',
        amount: 100,
      },
      idempotencyKey,
    );

    await notificationService.handleEscrowEvent(
      testUserId,
      NotificationEventType.ESCROW_FUNDED,
      {
        escrowId: testEscrowId,
        escrowTitle: 'Test Escrow',
        amount: 100,
      },
      idempotencyKey,
    );

    // Verify only 1 notification was created
    const notifications = await notificationRepo.find({
      where: {
        userId: testUserId,
        eventType: NotificationEventType.ESCROW_FUNDED,
        escrowId: testEscrowId,
      },
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0].idempotencyKey).toBe(idempotencyKey);
  });

  it('should create exactly 1 notification for milestone release event', async () => {
    const idempotencyKey = generateIdempotencyKey(
      NotificationEventType.MILESTONE_RELEASED,
      testEscrowId,
      testUserId,
    );

    // Call handleEscrowEvent twice with same idempotency key
    await notificationService.handleEscrowEvent(
      testUserId,
      NotificationEventType.MILESTONE_RELEASED,
      {
        escrowId: testEscrowId,
        milestoneIndex: 0,
        amount: 50,
      },
      idempotencyKey,
    );

    await notificationService.handleEscrowEvent(
      testUserId,
      NotificationEventType.MILESTONE_RELEASED,
      {
        escrowId: testEscrowId,
        milestoneIndex: 0,
        amount: 50,
      },
      idempotencyKey,
    );

    // Verify only 1 notification was created
    const notifications = await notificationRepo.find({
      where: {
        userId: testUserId,
        eventType: NotificationEventType.MILESTONE_RELEASED,
        escrowId: testEscrowId,
      },
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0].idempotencyKey).toBe(idempotencyKey);
  });

  it('should create exactly 1 notification per party for dispute filed event', async () => {
    const buyerId = 'buyer-user-id';
    const sellerId = 'seller-user-id';
    const adminId = 'admin-user-id';

    // Create additional users
    const buyer = userRepo.create({
      id: buyerId,
      walletAddress: 'buyer-wallet',
      email: 'buyer@example.com',
    });
    const seller = userRepo.create({
      id: sellerId,
      walletAddress: 'seller-wallet',
      email: 'seller@example.com',
    });
    const admin = userRepo.create({
      id: adminId,
      walletAddress: 'admin-wallet',
      email: 'admin@example.com',
      role: 'ADMIN' as any,
    });
    await userRepo.save([buyer, seller, admin]);

    // Create preferences for all users
    for (const userId of [buyerId, sellerId, adminId]) {
      const preference = preferenceRepo.create({
        id: `pref-${userId}`,
        userId,
        channel: NotificationChannel.EMAIL,
        enabled: true,
        eventTypes: [NotificationEventType.DISPUTE_RAISED],
      });
      await preferenceRepo.save(preference);
    }

    const disputeId = 'dispute-123';
    const payload = {
      escrowId: testEscrowId,
      escrowTitle: 'Test Escrow',
      disputeId,
    };

    // Simulate notification calls from EscrowService.notifyDisputeParticipants
    // This would normally be called for each participant
    const buyerKey = generateIdempotencyKey(
      NotificationEventType.DISPUTE_RAISED,
      testEscrowId,
      buyerId,
    );
    const sellerKey = generateIdempotencyKey(
      NotificationEventType.DISPUTE_RAISED,
      testEscrowId,
      sellerId,
    );
    const adminKey = generateIdempotencyKey(
      NotificationEventType.DISPUTE_RAISED,
      testEscrowId,
      adminId,
    );

    // Call for each participant
    await notificationService.handleEscrowEvent(
      buyerId,
      NotificationEventType.DISPUTE_RAISED,
      payload,
      buyerKey,
    );
    await notificationService.handleEscrowEvent(
      sellerId,
      NotificationEventType.DISPUTE_RAISED,
      payload,
      sellerKey,
    );
    await notificationService.handleEscrowEvent(
      adminId,
      NotificationEventType.DISPUTE_RAISED,
      payload,
      adminKey,
    );

    // Try to duplicate for seller
    await notificationService.handleEscrowEvent(
      sellerId,
      NotificationEventType.DISPUTE_RAISED,
      payload,
      sellerKey,
    );

    // Verify exactly 1 notification per user
    const buyerNotifications = await notificationRepo.find({
      where: {
        userId: buyerId,
        eventType: NotificationEventType.DISPUTE_RAISED,
        escrowId: testEscrowId,
      },
    });
    const sellerNotifications = await notificationRepo.find({
      where: {
        userId: sellerId,
        eventType: NotificationEventType.DISPUTE_RAISED,
        escrowId: testEscrowId,
      },
    });
    const adminNotifications = await notificationRepo.find({
      where: {
        userId: adminId,
        eventType: NotificationEventType.DISPUTE_RAISED,
        escrowId: testEscrowId,
      },
    });

    expect(buyerNotifications.length).toBe(1);
    expect(sellerNotifications.length).toBe(1);
    expect(adminNotifications.length).toBe(1);
  });

  it('should allow different events with different idempotency keys', async () => {
    const fundKey = generateIdempotencyKey(
      NotificationEventType.ESCROW_FUNDED,
      testEscrowId,
      testUserId,
    );
    const milestoneKey = generateIdempotencyKey(
      NotificationEventType.MILESTONE_RELEASED,
      testEscrowId,
      testUserId,
    );

    // Create two different events
    await notificationService.handleEscrowEvent(
      testUserId,
      NotificationEventType.ESCROW_FUNDED,
      { escrowId: testEscrowId },
      fundKey,
    );

    await notificationService.handleEscrowEvent(
      testUserId,
      NotificationEventType.MILESTONE_RELEASED,
      { escrowId: testEscrowId, milestoneIndex: 0 },
      milestoneKey,
    );

    // Verify both notifications were created
    const notifications = await notificationRepo.find({
      where: { userId: testUserId, escrowId: testEscrowId },
    });

    expect(notifications.length).toBe(2);
    expect(notifications.map((n) => n.eventType)).toContain(
      NotificationEventType.ESCROW_FUNDED,
    );
    expect(notifications.map((n) => n.eventType)).toContain(
      NotificationEventType.MILESTONE_RELEASED,
    );
  });

  it('should allow same event type for different users', async () => {
    const otherUserId = 'other-user-id';
    const otherUser = userRepo.create({
      id: otherUserId,
      walletAddress: 'other-wallet',
      email: 'other@example.com',
    });
    await userRepo.save(otherUser);

    const otherPreference = preferenceRepo.create({
      id: 'pref-other',
      userId: otherUserId,
      channel: NotificationChannel.EMAIL,
      enabled: true,
      eventTypes: [NotificationEventType.ESCROW_FUNDED],
    });
    await preferenceRepo.save(otherPreference);

    const userKey = generateIdempotencyKey(
      NotificationEventType.ESCROW_FUNDED,
      testEscrowId,
      testUserId,
    );
    const otherUserKey = generateIdempotencyKey(
      NotificationEventType.ESCROW_FUNDED,
      testEscrowId,
      otherUserId,
    );

    // Create notifications for both users
    await notificationService.handleEscrowEvent(
      testUserId,
      NotificationEventType.ESCROW_FUNDED,
      { escrowId: testEscrowId },
      userKey,
    );

    await notificationService.handleEscrowEvent(
      otherUserId,
      NotificationEventType.ESCROW_FUNDED,
      { escrowId: testEscrowId },
      otherUserKey,
    );

    // Verify both users got notifications
    const userNotifications = await notificationRepo.find({
      where: {
        userId: testUserId,
        eventType: NotificationEventType.ESCROW_FUNDED,
        escrowId: testEscrowId,
      },
    });
    const otherUserNotifications = await notificationRepo.find({
      where: {
        userId: otherUserId,
        eventType: NotificationEventType.ESCROW_FUNDED,
        escrowId: testEscrowId,
      },
    });

    expect(userNotifications.length).toBe(1);
    expect(otherUserNotifications.length).toBe(1);
  });

  it('should work without idempotency key (backwards compatibility)', async () => {
    // Call without idempotency key
    await notificationService.handleEscrowEvent(
      testUserId,
      NotificationEventType.ESCROW_FUNDED,
      { escrowId: testEscrowId },
    );

    // Should still create notification
    const notifications = await notificationRepo.find({
      where: {
        userId: testUserId,
        eventType: NotificationEventType.ESCROW_FUNDED,
        escrowId: testEscrowId,
      },
    });

    expect(notifications.length).toBe(1);
    expect(notifications[0].idempotencyKey).toBeNull();
  });
});
