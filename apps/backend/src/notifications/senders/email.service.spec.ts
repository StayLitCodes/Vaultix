/**
 * Integration test for EmailService using a nodemailer mock transport.
 *
 * nodemailer ships a built-in "ethereal" / "json" test transport. We use the
 * `nodemailer.createTransport` spy to inject a mock transport that captures
 * every `sendMail` call, giving us full visibility without needing a real SMTP
 * server.
 */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { Notification } from '../entities/notification.entity';
import {
  NotificationEventType,
  NotificationStatus,
} from '../enums/notification-event.enum';

// ---------------------------------------------------------------------------
// Mock transport factory
// ---------------------------------------------------------------------------

interface SentMail {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

function createMockTransport(failOnAttempt?: number) {
  let callCount = 0;
  const sentMails: SentMail[] = [];

  const transport = {
    sendMail: jest.fn(async (options: SentMail) => {
      callCount++;
      if (failOnAttempt !== undefined && callCount <= failOnAttempt) {
        throw new Error(`SMTP error on attempt ${callCount}`);
      }
      sentMails.push({ ...options });
      return { messageId: `mock-msg-id-${callCount}` };
    }),
    sentMails,
    getCallCount: () => callCount,
  };

  return transport;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeNotification(
  eventType: NotificationEventType,
  payload: Record<string, unknown> = {},
): Notification {
  return {
    id: 'ntf-001',
    userId: 'user-001',
    eventType,
    payload: {
      escrowId: 'escrow-abc',
      escrowTitle: 'Integration Test Escrow',
      email: 'recipient@example.com',
      amount: '500',
      asset: 'USDC',
      actionUrl: 'https://vaultix.io/escrows/escrow-abc',
      ...payload,
    },
    status: NotificationStatus.PENDING,
    retryCount: 0,
    readAt: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Notification;
}

// ---------------------------------------------------------------------------
// Shared module factory
// ---------------------------------------------------------------------------

type ConfigOverrides = Record<string, string>;

async function buildModule(
  configOverrides: ConfigOverrides = {},
  mockTransport?: ReturnType<typeof createMockTransport>,
): Promise<{ service: EmailService; transport: ReturnType<typeof createMockTransport> }> {
  const transport = mockTransport ?? createMockTransport();

  // Spy on createTransport to inject our mock
  jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transport as any);

  const defaultConfig: ConfigOverrides = {
    SMTP_HOST: 'smtp.test.local',
    SMTP_PORT: '587',
    SMTP_USER: 'test@test.local',
    SMTP_PASS: 'secret',
    EMAIL_FROM: 'noreply@vaultix.io',
    EMAIL_ENABLED: 'true',
    NODE_ENV: 'development', // live mode for integration tests
    ...configOverrides,
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EmailTemplateService,
      EmailService,
      {
        provide: ConfigService,
        useValue: {
          get: (key: string, fallback?: string) =>
            defaultConfig[key] ?? fallback ?? undefined,
        },
      },
    ],
  }).compile();

  const service = module.get<EmailService>(EmailService);
  return { service, transport };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailService (integration with mock SMTP)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Dry-run mode
  // -------------------------------------------------------------------------

  describe('dry-run mode', () => {
    it('should not call sendMail when EMAIL_ENABLED=false', async () => {
      const { service, transport } = await buildModule({
        EMAIL_ENABLED: 'false',
        NODE_ENV: 'development',
      });

      expect(service.isDryRun).toBe(true);

      const n = makeNotification(NotificationEventType.ESCROW_FUNDED);
      const result = await service.enqueue(n);

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(transport.sendMail).not.toHaveBeenCalled();
    });

    it('should not call sendMail when NODE_ENV=test', async () => {
      const { service, transport } = await buildModule({
        EMAIL_ENABLED: 'true',
        NODE_ENV: 'test',
      });

      expect(service.isDryRun).toBe(true);

      const n = makeNotification(NotificationEventType.ESCROW_CREATED);
      const result = await service.enqueue(n);

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(transport.sendMail).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Live delivery
  // -------------------------------------------------------------------------

  describe('live delivery', () => {
    it('should call sendMail with correct from/to/subject/html/text', async () => {
      const { service, transport } = await buildModule();

      const n = makeNotification(NotificationEventType.ESCROW_FUNDED, {
        email: 'buyer@example.com',
      });
      const result = await service.enqueue(n);

      expect(result.success).toBe(true);
      expect(result.dryRun).toBeUndefined();
      expect(transport.sendMail).toHaveBeenCalledTimes(1);

      const sent = transport.sentMails[0];
      expect(sent.from).toBe('noreply@vaultix.io');
      expect(sent.to).toBe('buyer@example.com');
      expect(sent.subject).toMatch(/funded/i);
      expect(sent.html).toContain('<!DOCTYPE html>');
      expect(sent.html).toContain('Vaultix');
      expect(typeof sent.text).toBe('string');
      expect(sent.text.length).toBeGreaterThan(0);
    });

    it('should resolve recipient from "userEmail" payload key', async () => {
      const { service, transport } = await buildModule();

      const n = makeNotification(NotificationEventType.ESCROW_CREATED, {
        userEmail: 'via-userEmail@example.com',
        email: undefined,
      });
      const result = await service.enqueue(n);

      expect(result.success).toBe(true);
      expect(transport.sentMails[0].to).toBe('via-userEmail@example.com');
    });

    it('should return failure without calling sendMail when no recipient email', async () => {
      const { service, transport } = await buildModule();

      const n = makeNotification(NotificationEventType.ESCROW_FUNDED, {
        email: undefined,
        userEmail: undefined,
        recipientEmail: undefined,
        to: undefined,
        buyerEmail: undefined,
        sellerEmail: undefined,
      });
      const result = await service.enqueue(n);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/no recipient/i);
      expect(transport.sendMail).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Retry with exponential back-off
  // -------------------------------------------------------------------------

  describe('retry with exponential back-off', () => {
    it('should succeed on the second attempt when the first fails', async () => {
      const transport = createMockTransport(1); // fail attempt 1, succeed on 2
      const { service } = await buildModule({}, transport);

      const n = makeNotification(NotificationEventType.DISPUTE_RAISED);
      const result = await service.enqueue(n);

      expect(result.success).toBe(true);
      // sendMail was called twice — once failed, once succeeded
      expect(transport.getCallCount()).toBe(2);
    });

    it('should return failure after exhausting all 3 retries', async () => {
      // Fail all 3 attempts
      const transport = createMockTransport(3);
      const { service } = await buildModule({}, transport);

      const n = makeNotification(NotificationEventType.DISPUTE_RESOLVED);
      const result = await service.enqueue(n);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/SMTP error/i);
      expect(transport.getCallCount()).toBe(3);
    }, 20_000); // allow up to 20 s for back-off sleeps in CI
  });

  // -------------------------------------------------------------------------
  // Multiple notifications queued sequentially
  // -------------------------------------------------------------------------

  describe('async queue', () => {
    it('should process multiple enqueued notifications in order', async () => {
      const { service, transport } = await buildModule();

      const events = [
        NotificationEventType.ESCROW_CREATED,
        NotificationEventType.ESCROW_FUNDED,
        NotificationEventType.MILESTONE_RELEASED,
      ];

      const results = await Promise.all(
        events.map((evt, i) =>
          service.enqueue(
            makeNotification(evt, { email: `user${i}@example.com` }),
          ),
        ),
      );

      expect(results.every((r) => r.success)).toBe(true);
      expect(transport.sentMails).toHaveLength(3);
      // Verify each was sent to the right address
      expect(transport.sentMails[0].to).toBe('user0@example.com');
      expect(transport.sentMails[1].to).toBe('user1@example.com');
      expect(transport.sentMails[2].to).toBe('user2@example.com');
    });
  });

  // -------------------------------------------------------------------------
  // Structured logging (smoke test — verify no errors thrown)
  // -------------------------------------------------------------------------

  describe('structured logging', () => {
    it('should complete without errors and include messageId in result', async () => {
      const { service } = await buildModule();
      const n = makeNotification(NotificationEventType.EXPIRATION_WARNING);
      const result = await service.enqueue(n);

      expect(result.success).toBe(true);
      expect(typeof result.messageId).toBe('string');
      expect(result.messageId).toMatch(/^mock-msg-id-/);
    });
  });
});
