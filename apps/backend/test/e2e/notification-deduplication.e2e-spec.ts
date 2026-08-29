# [DevBounty AI]: File optimized for resolution.
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  getRepositoryToken,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { NotificationService } from '../../src/notifications/notifications.service';
import { PreferenceService } from '../../src/notifications/preference.service';
import { Notification } from '../../src/notifications/entities/notification.entity';
import { NotificationPreference } from '../../src/notifications/entities/notification-preference.entity';
import { User } from '../../src/modules/user/entities/user.entity';
import { NotificationEventType } from '../../src/notifications/enums/notification-event.enum';
import { NotificationChannel } from '../../src/notifications/enums/notification-channel.enum';
import { EmailSender } from '../../src/notifications/senders/email.sender';
import { WebhookSender } from '../../src/notifications/senders/webhook.sender';
import { v4 as uuidv4 } from 'uuid';

/**
 * Integration test for Notification deduplication (idempotency).
 *
 * The test creates a user, then triggers the same notification twice with the
 * same idempotency key and expects only one entry in the DB. A third trigger
 * with a different key must result in a second entry.
 *
 * All escrow‑related tables are mocked out – the test only validates the
 * NotificationService behaviour.
 */
describe('Notification Deduplication (e2e‑style)', () => {
  let moduleRef: TestingModule;
  let notificationService: NotificationService;
  let notificationRepo: Repository<Notification>;
  let userRepo: Repository<User>;

  const testUserId = uuidv4();

  beforeAll(async () => {
    // Mock services that NotificationService depends on but are unrelated
    const mockEmailSender = { send: jest.fn().mockResolvedValue(undefined) };
    const mockWebhookSender = { send: jest.fn().mockResolvedValue(undefined) };
    const mockEscrowService = {
      // Only the methods used by NotificationService are stubbed.
      // If NotificationService calls other methods, they can be added later.
      getEscrowById: jest.fn().mockResolvedValue(null),
    };

    const typeOrmConfig: TypeOrmModuleOptions = {
      type: 'sqlite',
      database: ':memory:',
      // Auto‑create schema from the supplied entities
      synchronize: true,
      dropSchema: true,
      entities: [
        Notification,
        NotificationPreference,
        User,
        // If other entities are needed by NotificationService (e.g., Escrow),
        // they can be added here. For this test they are not required.
      ],
    };

    moduleRef = await Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(typeOrmConfig), TypeOrmModule.forFeature([Notification, NotificationPreference, User])],
      providers: [
        NotificationService,
        PreferenceService,
        { provide: EmailSender, useValue: mockEmailSender },
        { provide: WebhookSender, useValue: mockWebhookSender },
        { provide: 'EscrowService', useValue: mockEscrowService }, // token may differ; adjust if needed
      ],
    }).compile();

    notificationService = moduleRef.get(NotificationService);
    notificationRepo = moduleRef.get<Repository<Notification>>(getRepositoryToken(Notification));
    userRepo = moduleRef.get<Repository<User>>(getRepositoryToken(User));

    // Seed a test user – NotificationService expects a user entry for userId FK
    await userRepo.save({
      id: testUserId,
      walletAddress: 'GTESTWALLETADDRESS',
      role: 'USER',
      displayName: 'Test User',
      email: 'test@example.com',
      emailVerified: true,
    });
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    // Ensure a clean state before each test
    await notificationRepo.clear();
  });

  it('creates a notification on first call with a given idempotency key', async () => {
    const idempotencyKey = 'fund-escrow-123';
    await notificationService.createNotification({
      userId: testUserId,
      escrowId: null,
      eventType: NotificationEventType.FUND_ESCROW,
      payload: { amount: 100 },
      channel: NotificationChannel.EMAIL,
      idempotencyKey,
    });

    const count = await notificationRepo.count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });

  it('does not create a duplicate notification when the same idempotency key is used', async () => {
    const idempotencyKey = 'fund-escrow-dup';

    // First call – should create
    await notificationService.createNotification({
      userId: testUserId,
      escrowId: null,
      eventType: NotificationEventType.FUND_ESCROW,
      payload: { amount: 200 },
      channel: NotificationChannel.EMAIL,
      idempotencyKey,
    });

    // Second call with the *same* idempotency key – should be ignored
    await notificationService.createNotification({
      userId: testUserId,
      escrowId: null,
      eventType: NotificationEventType.FUND_ESCROW,
      payload: { amount: 200 },
      channel: NotificationChannel.EMAIL,
      idempotencyKey,
    });

    const count = await notificationRepo.count({ where: { idempotencyKey } });
    expect(count).toBe(1);
  });

  it('creates separate notifications for different idempotency keys', async () => {
    const keyA = 'complete-milestone-A';
    const keyB = 'complete-milestone-B';

    await notificationService.createNotification({
      userId: testUserId,
      escrowId: null,
      eventType: NotificationEventType.COMPLETE_MILESTONE,
      payload: { milestoneId: 'mil1' },
      channel: NotificationChannel.EMAIL,
      idempotencyKey: keyA,
    });

    await notificationService.createNotification({
      userId: testUserId,
      escrowId: null,
      eventType: NotificationEventType.COMPLETE_MILESTONE,
      payload: { milestoneId: 'mil2' },
      channel: NotificationChannel.EMAIL,
      idempotencyKey: keyB,
    });

    const countA = await notificationRepo.count({ where: { idempotencyKey: keyA } });
    const countB = await notificationRepo.count({ where: { idempotencyKey: keyB } });

    expect(countA).toBe(1);
    expect(countB).toBe(1);
    expect(await notificationRepo.count()).toBe(2);
  });
});