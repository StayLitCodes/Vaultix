import { EmailTemplateService } from './email-template.service';
import { Notification } from '../entities/notification.entity';
import {
  NotificationEventType,
  NotificationStatus,
} from '../enums/notification-event.enum';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNotification(
  eventType: NotificationEventType,
  payload: Record<string, unknown> = {},
): Notification {
  return {
    id: 'test-id-001',
    userId: 'user-001',
    eventType,
    payload: {
      escrowId: 'escrow-123',
      escrowTitle: 'Test Escrow',
      email: 'user@example.com',
      ...payload,
    },
    status: NotificationStatus.PENDING,
    retryCount: 0,
    readAt: undefined,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date('2024-01-01T00:00:00Z'),
  } as Notification;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('EmailTemplateService', () => {
  let service: EmailTemplateService;

  beforeEach(() => {
    service = new EmailTemplateService();
  });

  // -------------------------------------------------------------------------
  // Structural checks (all templates)
  // -------------------------------------------------------------------------

  describe('HTML structure', () => {
    const allEvents = Object.values(NotificationEventType);

    it.each(allEvents)(
      'should produce valid HTML with branding header for event %s',
      (eventType) => {
        const n = makeNotification(eventType as NotificationEventType);
        const result = service.build(n);

        expect(result.html).toContain('<!DOCTYPE html>');
        // Branding header
        expect(result.html).toContain('Vaultix');
        expect(result.html).toContain('background:#7C3AED');
        // CTA placeholder or unsubscribe footer
        expect(result.html).toContain('Unsubscribe');
        expect(result.html).toContain('notifications/unsubscribe');
        // Privacy policy link
        expect(result.html).toContain('Privacy Policy');
      },
    );

    it.each(allEvents)(
      'should produce a non-empty subject for event %s',
      (eventType) => {
        const n = makeNotification(eventType as NotificationEventType);
        const { subject } = service.build(n);
        expect(typeof subject).toBe('string');
        expect(subject.length).toBeGreaterThan(0);
      },
    );

    it.each(allEvents)(
      'should produce a non-empty plain-text body for event %s',
      (eventType) => {
        const n = makeNotification(eventType as NotificationEventType);
        const { text } = service.build(n);
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
      },
    );
  });

  // -------------------------------------------------------------------------
  // CTA button
  // -------------------------------------------------------------------------

  describe('CTA button', () => {
    it('should include a CTA button when actionUrl is provided', () => {
      const n = makeNotification(NotificationEventType.ESCROW_FUNDED, {
        actionUrl: 'https://vaultix.io/escrows/escrow-123',
      });
      const { html } = service.build(n);
      expect(html).toContain('View in Vaultix');
      expect(html).toContain('https://vaultix.io/escrows/escrow-123');
    });

    it('should not include a CTA button when actionUrl is absent', () => {
      const n = makeNotification(NotificationEventType.ESCROW_FUNDED);
      const { html } = service.build(n);
      expect(html).not.toContain('View in Vaultix');
    });

    it('should include actionUrl in plain-text when provided', () => {
      const n = makeNotification(NotificationEventType.ESCROW_FUNDED, {
        actionUrl: 'https://vaultix.io/escrows/abc',
      });
      const { text } = service.build(n);
      expect(text).toContain('https://vaultix.io/escrows/abc');
    });
  });

  // -------------------------------------------------------------------------
  // Individual templates
  // -------------------------------------------------------------------------

  describe('PARTY_INVITED template', () => {
    it('should include role and escrow title in subject', () => {
      const n = makeNotification(NotificationEventType.PARTY_INVITED, {
        role: 'buyer',
        escrowTitle: 'My Deal',
      });
      const { subject, html } = service.build(n);
      expect(subject).toContain('My Deal');
      expect(html).toContain('buyer');
    });

    it('should include amount when present', () => {
      const n = makeNotification(NotificationEventType.PARTY_INVITED, {
        amount: '500',
        asset: 'USDC',
      });
      const { html, text } = service.build(n);
      expect(html).toContain('500');
      expect(html).toContain('USDC');
      expect(text).toContain('500 USDC');
    });
  });

  describe('ESCROW_FUNDED template', () => {
    it('should mention funded in subject and body', () => {
      const n = makeNotification(NotificationEventType.ESCROW_FUNDED, {
        amount: '1000',
        asset: 'XLM',
      });
      const { subject, html, text } = service.build(n);
      expect(subject.toLowerCase()).toContain('funded');
      expect(html.toLowerCase()).toContain('funded');
      expect(text).toContain('1000 XLM');
    });
  });

  describe('MILESTONE_RELEASED template', () => {
    it('should mention milestone release', () => {
      const n = makeNotification(NotificationEventType.MILESTONE_RELEASED);
      const { html, text } = service.build(n);
      expect(html.toLowerCase()).toContain('milestone');
      expect(text.toLowerCase()).toContain('milestone');
    });
  });

  describe('ESCROW_COMPLETED template', () => {
    it('should mention completion', () => {
      const n = makeNotification(NotificationEventType.ESCROW_COMPLETED);
      const { subject, html } = service.build(n);
      expect(subject.toLowerCase()).toContain('completed');
      expect(html.toLowerCase()).toContain('completed');
    });
  });

  describe('DISPUTE_RAISED template', () => {
    it('should include dispute ID when present', () => {
      const n = makeNotification(NotificationEventType.DISPUTE_RAISED, {
        disputeId: 'dispute-456',
      });
      const { html, text } = service.build(n);
      expect(html).toContain('dispute-456');
      expect(text).toContain('dispute-456');
    });

    it('should not crash when dispute ID is absent', () => {
      const n = makeNotification(NotificationEventType.DISPUTE_RAISED);
      expect(() => service.build(n)).not.toThrow();
    });
  });

  describe('DISPUTE_RESOLVED template', () => {
    it('should mention resolution', () => {
      const n = makeNotification(NotificationEventType.DISPUTE_RESOLVED, {
        disputeId: 'dispute-789',
      });
      const { subject, html } = service.build(n);
      expect(subject.toLowerCase()).toContain('resolved');
      expect(html.toLowerCase()).toContain('resolved');
      expect(html).toContain('dispute-789');
    });
  });

  describe('EXPIRATION_WARNING template (Deadline Approaching)', () => {
    it('should include expiry time when provided', () => {
      const n = makeNotification(NotificationEventType.EXPIRATION_WARNING, {
        expiresAt: '2024-12-31T23:59:00Z',
      });
      const { subject, html, text } = service.build(n);
      expect(subject.toLowerCase()).toContain('expir');
      expect(html).toContain('2024-12-31T23:59:00Z');
      expect(text).toContain('2024-12-31T23:59:00Z');
    });

    it('should still work without expiresAt', () => {
      const n = makeNotification(NotificationEventType.EXPIRATION_WARNING);
      const { html } = service.build(n);
      expect(html.toLowerCase()).toContain('expir');
    });
  });

  describe('CONDITION_FULFILLED template', () => {
    it('should include condition text', () => {
      const n = makeNotification(NotificationEventType.CONDITION_FULFILLED, {
        condition: 'Delivery confirmed by logistics',
      });
      const { html, text } = service.build(n);
      expect(html).toContain('Delivery confirmed by logistics');
      expect(text).toContain('Delivery confirmed by logistics');
    });
  });

  describe('CONDITION_CONFIRMED template', () => {
    it('should include condition text', () => {
      const n = makeNotification(NotificationEventType.CONDITION_CONFIRMED, {
        condition: 'Inspection passed',
      });
      const { html, text } = service.build(n);
      expect(html).toContain('Inspection passed');
      expect(text).toContain('Inspection passed');
    });
  });

  describe('ESCROW_CANCELLED template', () => {
    it('should mention cancellation', () => {
      const n = makeNotification(NotificationEventType.ESCROW_CANCELLED);
      const { subject, html, text } = service.build(n);
      expect(subject.toLowerCase()).toContain('cancel');
      expect(html.toLowerCase()).toContain('cancel');
      expect(text.toLowerCase()).toContain('cancel');
    });
  });

  describe('ESCROW_EXPIRED template', () => {
    it('should mention expiration', () => {
      const n = makeNotification(NotificationEventType.ESCROW_EXPIRED);
      const { subject, html } = service.build(n);
      expect(subject.toLowerCase()).toContain('expir');
      expect(html.toLowerCase()).toContain('expir');
    });
  });

  // -------------------------------------------------------------------------
  // Unsubscribe footer
  // -------------------------------------------------------------------------

  describe('Unsubscribe footer', () => {
    it('should embed notification ID in unsubscribe URL', () => {
      const n = makeNotification(NotificationEventType.ESCROW_CREATED);
      const { html, text } = service.build(n);
      expect(html).toContain('nid=test-id-001');
      expect(text).toContain('nid=test-id-001');
    });
  });

  // -------------------------------------------------------------------------
  // XSS / injection safety
  // -------------------------------------------------------------------------

  describe('HTML escaping', () => {
    it('should escape < > & in payload values', () => {
      const n = makeNotification(NotificationEventType.ESCROW_CREATED, {
        escrowTitle: '<script>alert("xss")</script>',
        escrowId: 'e-001',
      });
      const { html } = service.build(n);
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('should escape quotes in actionUrl', () => {
      const n = makeNotification(NotificationEventType.ESCROW_FUNDED, {
        actionUrl: 'https://vaultix.io/x?q="test"',
      });
      const { html } = service.build(n);
      expect(html).not.toContain('"test"');
      expect(html).toContain('&quot;test&quot;');
    });
  });
});
