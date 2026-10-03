import { BadRequestException } from '@nestjs/common';
import { EmailTemplatesService } from './email-templates.service';
import {
  EMAIL_TEMPLATE_NAMES,
  EmailTemplateData,
  EmailTemplateName,
} from './email.types';

describe('EmailTemplatesService', () => {
  let service: EmailTemplatesService;

  const exampleData: Record<EmailTemplateName, EmailTemplateData> = {
    verification: {
      userName: 'Alice',
      email: 'alice@example.com',
      verificationUrl: 'https://app.vaultix.io/verify?token=abc-123',
    },
    'password-reset': {
      userName: 'Alice',
      email: 'alice@example.com',
      resetUrl: 'https://app.vaultix.io/reset?token=reset-456',
      expiresIn: '1 hour',
    },
    'escrow-invitation': {
      userName: 'Alice',
      escrowTitle: 'Logo design escrow',
      escrowId: 'escrow_1',
      role: 'seller',
      amount: '250',
      asset: 'XLM',
      actionUrl: 'https://app.vaultix.io/escrows/escrow_1',
    },
    'escrow-status': {
      userName: 'Alice',
      escrowTitle: 'Logo design escrow',
      escrowId: 'escrow_1',
      status: 'funded',
      amount: '250',
      asset: 'XLM',
      actionUrl: 'https://app.vaultix.io/escrows/escrow_1',
    },
    'dispute-filed': {
      userName: 'Alice',
      escrowTitle: 'Logo design escrow',
      escrowId: 'escrow_1',
      disputeId: 'dispute_9',
      reason: 'Work not delivered',
      actionUrl: 'https://app.vaultix.io/disputes/dispute_9',
    },
    'dispute-resolved': {
      userName: 'Alice',
      escrowTitle: 'Logo design escrow',
      escrowId: 'escrow_1',
      disputeId: 'dispute_9',
      outcome: 'refunded_to_buyer',
      actionUrl: 'https://app.vaultix.io/disputes/dispute_9',
    },
    'milestone-release': {
      userName: 'Alice',
      escrowTitle: 'Logo design escrow',
      escrowId: 'escrow_1',
      milestoneTitle: 'First draft',
      amount: '100',
      asset: 'XLM',
      actionUrl: 'https://app.vaultix.io/escrows/escrow_1',
    },
  };

  beforeEach(() => {
    service = new EmailTemplatesService();
  });

  describe.each(EMAIL_TEMPLATE_NAMES)('%s template', (template) => {
    it('renders successfully with branding, values, links and text fallback', () => {
      const rendered = service.renderTemplate(template, exampleData[template]);

      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.text.length).toBeGreaterThan(0);
      // Vaultix branding from the shared base layout.
      expect(rendered.html).toContain('Vaultix');
      expect(rendered.html).toContain('Secure escrow on Stellar');
      expect(rendered.html).toContain('#8b5cf6');
      // Supplied dynamic values are present.
      expect(rendered.html).toContain('Alice');
      expect(rendered.text).toContain('Alice');
      // No unresolved template variables or placeholders leak through.
      expect(rendered.html).not.toMatch(/\{\{\s*\w+\s*\}\}/);
      expect(rendered.html).not.toContain('undefined');
      expect(rendered.html).not.toContain('[object Object]');
      expect(rendered.text).not.toContain('undefined');
      // Email-client safety: no scripts, no external resources.
      expect(rendered.html).not.toContain('<script');
      expect(rendered.html).not.toContain('javascript:');
    });
  });

  it('includes the correct links for link-bearing templates', () => {
    const verification = service.renderVerification(
      exampleData.verification as {
        userName: string;
        email: string;
        verificationUrl: string;
      },
    );
    expect(verification.html).toContain(
      'https://app.vaultix.io/verify?token=abc-123',
    );
    expect(verification.text).toContain(
      'https://app.vaultix.io/verify?token=abc-123',
    );

    const reset = service.renderPasswordReset(
      exampleData['password-reset'] as {
        userName: string;
        email: string;
        resetUrl: string;
      },
    );
    expect(reset.html).toContain('https://app.vaultix.io/reset?token=reset-456');
    expect(reset.text).toContain('https://app.vaultix.io/reset?token=reset-456');

    const invitation = service.renderEscrowInvitation(
      exampleData['escrow-invitation'] as {
        escrowTitle: string;
        escrowId: string;
      },
    );
    expect(invitation.subject).toContain('Logo design escrow');
    expect(invitation.html).toContain('escrow_1');
  });

  it('uses the expected subjects', () => {
    expect(
      service.renderVerification(
        exampleData.verification as {
          email: string;
          verificationUrl: string;
        },
      ).subject,
    ).toContain('Verify');
    expect(
      service.renderPasswordReset(
        exampleData['password-reset'] as {
          email: string;
          resetUrl: string;
        },
      ).subject,
    ).toContain('Reset');
    const disputeFiled = service.renderDisputeFiled(
      exampleData['dispute-filed'] as {
        escrowTitle: string;
        escrowId: string;
        disputeId: string;
      },
    );
    expect(disputeFiled.subject).toContain('escrow_1');
    expect(disputeFiled.html).toContain('dispute_9');
    expect(
      service.renderMilestoneRelease(
        exampleData['milestone-release'] as {
          escrowTitle: string;
          escrowId: string;
        },
      ).subject,
    ).toContain('escrow_1');
  });

  describe('security', () => {
    it('escapes malicious HTML in dynamic values', () => {
      const rendered = service.renderVerification({
        userName: '<script>alert("xss")</script>',
        email: 'alice@example.com',
        verificationUrl: 'https://app.vaultix.io/verify?token=abc',
      });

      expect(rendered.html).not.toContain('<script>alert');
      expect(rendered.html).toContain(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
    });

    it('does not render injected markup from dispute reason fields', () => {
      const rendered = service.renderDisputeFiled({
        escrowTitle: 'Logo design escrow',
        escrowId: 'escrow_1',
        disputeId: 'dispute_9',
        reason: '<img src=x onerror=alert(1)>',
      });

      expect(rendered.html).not.toContain('<img src=x onerror=alert(1)>');
      expect(rendered.html).toContain(
        '&lt;img src=x onerror=alert(1)&gt;',
      );
    });

    it('drops unsafe (non-http) link targets instead of rendering them', () => {
      const rendered = service.renderVerification({
        email: 'alice@example.com',
        verificationUrl: 'javascript:alert(1)',
      });

      expect(rendered.html).not.toContain('javascript:alert(1)');
      expect(rendered.html).not.toContain('<a href');
    });

    it('rejects unknown template names', () => {
      expect(() =>
        service.renderTemplate('not-a-template', {} as EmailTemplateData),
      ).toThrow(BadRequestException);
    });

    it('rejects missing required fields', () => {
      expect(() =>
        service.renderVerification({
          email: '',
          verificationUrl: 'https://app.vaultix.io/verify?token=abc',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        service.renderPasswordReset({
          email: 'alice@example.com',
          resetUrl: '',
        }),
      ).toThrow(BadRequestException);
    });
  });

  describe('preview data', () => {
    it('renders every template with synthetic example data', () => {
      for (const template of EMAIL_TEMPLATE_NAMES) {
        const rendered = service.renderPreview(template);
        expect(rendered.subject.length).toBeGreaterThan(0);
        expect(rendered.html).toContain('Vaultix');
        expect(rendered.html).not.toMatch(/\{\{\s*\w+\s*\}\}/);
      }
    });

    it('preview data is synthetic (no real users, secrets or credentials)', () => {
      for (const template of EMAIL_TEMPLATE_NAMES) {
        const data = service.getPreviewData(template) as unknown as Record<
          string,
          unknown
        >;
        for (const value of Object.values(data)) {
          if (typeof value !== 'string') continue;
          // No credential-like material.
          expect(value).not.toMatch(/smtp|secret|private[_-]?key|bearer\s/i);
          // Email addresses and links point at reserved example domains.
          if (value.includes('@')) {
            expect(value).toMatch(/@example\.(com|org|net)$/);
          }
          if (/^https?:\/\//.test(value)) {
            expect(value).toMatch(/^https:\/\/app\.vaultix\.io\//);
          }
        }
      }
    });
  });
});
