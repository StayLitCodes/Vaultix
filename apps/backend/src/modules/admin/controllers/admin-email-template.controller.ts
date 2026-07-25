import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Header,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { EmailTemplateService } from '../../../notifications/services/email-template.service';
import { NotificationEventType } from '../../../notifications/enums/notification-event.enum';

const PREVIEW_SAMPLES: Record<
  string,
  {
    eventType?: NotificationEventType;
    payload: Record<string, unknown>;
  }
> = {
  'email-verification': {
    payload: {
      code: 'ABC12345',
      expiresIn: '24 hours',
    },
  },
  'password-reset': {
    payload: {
      actionUrl: 'https://vaultix.io/reset?token=abc123',
      expiresIn: '1 hour',
    },
  },
  'escrow-invitation': {
    eventType: NotificationEventType.PARTY_INVITED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      role: 'seller',
      actionUrl: 'https://vaultix.io/escrows/ESC-2024-001',
      recipientEmail: 'user@example.com',
    },
  },
  'escrow-status-change': {
    eventType: NotificationEventType.ESCROW_FUNDED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      status: 'funded',
      actionUrl: 'https://vaultix.io/escrows/ESC-2024-001',
      recipientEmail: 'user@example.com',
    },
  },
  'dispute-filed': {
    eventType: NotificationEventType.DISPUTE_RAISED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      disputeId: 'DSP-001',
      actionUrl: 'https://vaultix.io/disputes/DSP-001',
      recipientEmail: 'user@example.com',
    },
  },
  'dispute-resolved': {
    eventType: NotificationEventType.DISPUTE_RESOLVED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      disputeId: 'DSP-001',
      resolution: 'Funds released to seller',
      actionUrl: 'https://vaultix.io/disputes/DSP-001',
      recipientEmail: 'user@example.com',
    },
  },
  'milestone-release': {
    eventType: NotificationEventType.MILESTONE_RELEASED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      milestoneName: 'Design Phase',
      milestoneAmount: '150',
      actionUrl: 'https://vaultix.io/escrows/ESC-2024-001',
      recipientEmail: 'user@example.com',
    },
  },
  'party-accepted': {
    eventType: NotificationEventType.PARTY_ACCEPTED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      role: 'buyer',
      actionUrl: 'https://vaultix.io/escrows/ESC-2024-001',
      recipientEmail: 'user@example.com',
    },
  },
  'party-rejected': {
    eventType: NotificationEventType.PARTY_REJECTED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      role: 'seller',
      actionUrl: 'https://vaultix.io/escrows/ESC-2024-001',
      recipientEmail: 'user@example.com',
    },
  },
  'condition-fulfilled': {
    eventType: NotificationEventType.CONDITION_FULFILLED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      condition: 'Delivery of design mockups',
      actionUrl: 'https://vaultix.io/escrows/ESC-2024-001',
      recipientEmail: 'user@example.com',
    },
  },
  'condition-confirmed': {
    eventType: NotificationEventType.CONDITION_CONFIRMED,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      condition: 'Delivery of design mockups',
      actionUrl: 'https://vaultix.io/escrows/ESC-2024-001',
      recipientEmail: 'user@example.com',
    },
  },
  'expiration-warning': {
    eventType: NotificationEventType.EXPIRATION_WARNING,
    payload: {
      escrowId: 'ESC-2024-001',
      escrowTitle: 'Website Development Project',
      amount: '500',
      asset: 'XLM',
      expiresAt: '2024-12-31T23:59:59Z',
      actionUrl: 'https://vaultix.io/escrows/ESC-2024-001',
      recipientEmail: 'user@example.com',
    },
  },
};

@Controller('admin/email-templates')
@UseGuards(AuthGuard, AdminGuard)
export class AdminEmailTemplateController {
  constructor(private readonly templateService: EmailTemplateService) {}

  @Get()
  listTemplates() {
    return {
      templates: Object.keys(PREVIEW_SAMPLES),
      available: this.templateService.getAvailableTemplates(),
    };
  }

  @Get('preview/:templateName')
  @Header('Content-Type', 'text/html')
  previewTemplate(
    @Param('templateName') templateName: string,
    @Query('format') format?: string,
  ) {
    const sample = PREVIEW_SAMPLES[templateName];
    if (!sample) {
      throw new BadRequestException(
        `Unknown template "${templateName}". Available: ${Object.keys(PREVIEW_SAMPLES).join(', ')}`,
      );
    }

    let html: string;
    let subject: string;
    let text: string;

    if (sample.eventType) {
      const result = this.templateService.renderFromNotification(
        sample.eventType,
        sample.payload,
      );
      html = result.html;
      subject = result.subject;
      text = result.text;
    } else {
      if (templateName === 'email-verification') {
        const result = this.templateService.renderVerificationEmail({
          code: sample.payload.code as string,
          expiresIn: sample.payload.expiresIn as string,
        });
        html = result.html;
        subject = result.subject;
        text = result.text;
      } else if (templateName === 'password-reset') {
        const result = this.templateService.renderPasswordResetEmail({
          actionUrl: sample.payload.actionUrl as string,
          expiresIn: sample.payload.expiresIn as string,
        });
        html = result.html;
        subject = result.subject;
        text = result.text;
      } else {
        throw new BadRequestException(
          `Template "${templateName}" is not renderable`,
        );
      }
    }

    if (format === 'json') {
      return { subject, html, text };
    }

    return html;
  }
}
