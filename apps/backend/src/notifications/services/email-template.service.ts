import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Handlebars from 'handlebars';
import * as fs from 'fs';
import * as path from 'path';
import { NotificationEventType } from '../enums/notification-event.enum';

export interface EmailRenderResult {
  subject: string;
  html: string;
  text: string;
}

export interface EscrowDetailsData {
  escrowId?: string;
  escrowTitle?: string;
  amount?: string;
  asset?: string;
  status?: string;
  statusColor?: string;
}

@Injectable()
export class EmailTemplateService implements OnModuleInit {
  private readonly logger = new Logger(EmailTemplateService.name);
  private readonly templatesDir: string;
  private compiledTemplates: Map<string, HandlebarsTemplateDelegate> =
    new Map();
  private compiledPartials: Map<string, HandlebarsTemplateDelegate> =
    new Map();
  private baseLayout: HandlebarsTemplateDelegate | null = null;
  private readonly appName: string;

  constructor(private readonly configService: ConfigService) {
    this.templatesDir = path.join(__dirname, 'templates');
    this.appName = this.configService.get<string>('APP_NAME', 'Vaultix');
  }

  onModuleInit() {
    this.registerHelpers();
    this.loadPartials();
    this.loadTemplates();
    this.logger.log(
      `Email templates loaded: ${this.compiledTemplates.size} templates, ${this.compiledPartials.size} partials`,
    );
  }

  render(templateName: string, data: Record<string, unknown>): string {
    const compiled = this.compiledTemplates.get(templateName);
    if (!compiled) {
      throw new Error(`Email template "${templateName}" not found`);
    }

    const content = compiled(data);

    if (!this.baseLayout) {
      this.logger.warn('Base layout not loaded, returning raw content');
      return content;
    }

    return this.baseLayout({
      title: data.subject ?? this.appName,
      content,
      year: new Date().getFullYear(),
    });
  }

  renderRaw(templateName: string, data: Record<string, unknown>): string {
    const compiled = this.compiledTemplates.get(templateName);
    if (!compiled) {
      throw new Error(`Email template "${templateName}" not found`);
    }
    return compiled(data);
  }

  getAvailableTemplates(): string[] {
    return Array.from(this.compiledTemplates.keys());
  }

  renderVerificationEmail(data: {
    code: string;
    expiresIn: string;
  }): EmailRenderResult {
    return {
      subject: `Verify your ${this.appName} email address`,
      html: this.render('email-verification', { ...data }),
      text: this.buildVerificationText(data),
    };
  }

  renderPasswordResetEmail(data: {
    actionUrl: string;
    expiresIn: string;
  }): EmailRenderResult {
    return {
      subject: `Reset your ${this.appName} password`,
      html: this.render('password-reset', {
        ...data,
        buttonHtml: this.renderPartial('button', {
          label: 'Reset Password',
          url: data.actionUrl,
        }),
      }),
      text: this.buildPasswordResetText(data),
    };
  }

  renderFromNotification(
    eventType: NotificationEventType,
    payload: Record<string, unknown>,
  ): EmailRenderResult {
    const escrowDetails = this.buildEscrowDetails(payload);
    const actionUrl = this.readString(payload, 'actionUrl');

    switch (eventType) {
      case NotificationEventType.PARTY_INVITED:
        return this.renderEscrowInvitation(payload, escrowDetails, actionUrl);
      case NotificationEventType.PARTY_ACCEPTED:
        return this.renderPartyAccepted(payload, escrowDetails, actionUrl);
      case NotificationEventType.PARTY_REJECTED:
        return this.renderPartyRejected(payload, escrowDetails, actionUrl);
      case NotificationEventType.ESCROW_CREATED:
        return this.renderEscrowStatusChange(
          'Escrow created',
          `A new escrow has been created and is awaiting funding.`,
          escrowDetails,
          actionUrl,
          payload,
        );
      case NotificationEventType.ESCROW_FUNDED:
        return this.renderEscrowStatusChange(
          'Escrow funded',
          `The escrow has been funded and is now active.`,
          escrowDetails,
          actionUrl,
          payload,
        );
      case NotificationEventType.ESCROW_COMPLETED:
        return this.renderEscrowStatusChange(
          'Escrow completed',
          `The escrow transaction has been successfully completed.`,
          escrowDetails,
          actionUrl,
          payload,
        );
      case NotificationEventType.ESCROW_CANCELLED:
        return this.renderEscrowStatusChange(
          'Escrow cancelled',
          `The escrow transaction has been cancelled.`,
          escrowDetails,
          actionUrl,
          payload,
        );
      case NotificationEventType.ESCROW_EXPIRED:
        return this.renderEscrowStatusChange(
          'Escrow expired',
          `The escrow has expired and funds have been returned.`,
          escrowDetails,
          actionUrl,
          payload,
        );
      case NotificationEventType.MILESTONE_RELEASED:
        return this.renderMilestoneRelease(payload, escrowDetails, actionUrl);
      case NotificationEventType.DISPUTE_RAISED:
        return this.renderDisputeFiled(payload, escrowDetails, actionUrl);
      case NotificationEventType.DISPUTE_RESOLVED:
        return this.renderDisputeResolved(payload, escrowDetails, actionUrl);
      case NotificationEventType.CONDITION_FULFILLED:
        return this.renderConditionFulfilled(
          payload,
          escrowDetails,
          actionUrl,
        );
      case NotificationEventType.CONDITION_CONFIRMED:
        return this.renderConditionConfirmed(
          payload,
          escrowDetails,
          actionUrl,
        );
      case NotificationEventType.EXPIRATION_WARNING:
        return this.renderExpirationWarning(payload, escrowDetails, actionUrl);
      default:
        return this.renderGenericNotification(eventType, payload, actionUrl);
    }
  }

  private renderEscrowInvitation(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const role = this.readString(payload, 'role') ?? 'participant';
    const subject = `You've been invited to escrow: ${escrowDetails.escrowTitle ?? 'Escrow'}`;
    return {
      subject,
      html: this.render('escrow-invitation', {
        role,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', {
              label: 'View Escrow Details',
              url: actionUrl,
            })
          : '',
      }),
      text: this.buildEscrowInvitationText(payload, role),
    };
  }

  private renderPartyAccepted(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const role = this.readString(payload, 'role') ?? 'party';
    const subject = `Party accepted invitation for escrow ${escrowDetails.escrowId ?? ''}`;
    return {
      subject,
      html: this.render('party-accepted', {
        role,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', {
              label: 'View Escrow',
              url: actionUrl,
            })
          : '',
      }),
      text: `A party has accepted their ${role} invitation for escrow ${escrowDetails.escrowId ?? 'unknown'}.`,
    };
  }

  private renderPartyRejected(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const role = this.readString(payload, 'role') ?? 'party';
    const subject = `Party declined invitation for escrow ${escrowDetails.escrowId ?? ''}`;
    return {
      subject,
      html: this.render('party-rejected', {
        role,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', {
              label: 'View Escrow',
              url: actionUrl,
            })
          : '',
      }),
      text: `A party has declined their ${role} invitation for escrow ${escrowDetails.escrowId ?? 'unknown'}.`,
    };
  }

  private renderEscrowStatusChange(
    heading: string,
    message: string,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
    payload: Record<string, unknown>,
  ): EmailRenderResult {
    const subject = `${heading}: ${escrowDetails.escrowTitle ?? escrowDetails.escrowId ?? 'Escrow'}`;
    return {
      subject,
      html: this.render('escrow-status-change', {
        heading,
        message,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', { label: 'View Details', url: actionUrl })
          : '',
      }),
      text: `${message}\n\nEscrow: ${escrowDetails.escrowTitle ?? 'N/A'}\nID: ${escrowDetails.escrowId ?? 'unknown'}`,
    };
  }

  private renderMilestoneRelease(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const milestoneName =
      this.readString(payload, 'milestoneName') ??
      this.readString(payload, 'milestone');
    const milestoneAmount = this.readString(payload, 'milestoneAmount');
    const subject = `Milestone released for escrow ${escrowDetails.escrowId ?? ''}`;
    return {
      subject,
      html: this.render('milestone-release', {
        milestoneName,
        milestoneAmount,
        asset: escrowDetails.asset,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', { label: 'View Details', url: actionUrl })
          : '',
      }),
      text: `A milestone has been released for escrow ${escrowDetails.escrowId ?? 'unknown'}.${milestoneName ? ` Milestone: ${milestoneName}.` : ''}${milestoneAmount ? ` Amount: ${milestoneAmount} ${escrowDetails.asset ?? ''}.` : ''}`,
    };
  }

  private renderDisputeFiled(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const disputeId = this.readString(payload, 'disputeId');
    const subject = `Dispute filed for escrow ${escrowDetails.escrowId ?? ''}`;
    return {
      subject,
      html: this.render('dispute-filed', {
        disputeId,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', {
              label: 'Review Dispute',
              url: actionUrl,
            })
          : '',
      }),
      text: `A dispute${disputeId ? ` (${disputeId})` : ''} has been filed for escrow ${escrowDetails.escrowId ?? 'unknown'}.`,
    };
  }

  private renderDisputeResolved(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const disputeId = this.readString(payload, 'disputeId');
    const resolution = this.readString(payload, 'resolution');
    const subject = `Dispute resolved for escrow ${escrowDetails.escrowId ?? ''}`;
    return {
      subject,
      html: this.render('dispute-resolved', {
        disputeId,
        resolution,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', {
              label: 'View Resolution',
              url: actionUrl,
            })
          : '',
      }),
      text: `Dispute${disputeId ? ` (${disputeId})` : ''} has been resolved for escrow ${escrowDetails.escrowId ?? 'unknown'}.${resolution ? ` Resolution: ${resolution}` : ''}`,
    };
  }

  private renderConditionFulfilled(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const condition = this.readString(payload, 'condition');
    const subject = `Condition fulfilled for escrow ${escrowDetails.escrowId ?? ''}`;
    return {
      subject,
      html: this.render('condition-fulfilled', {
        condition,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', { label: 'View Details', url: actionUrl })
          : '',
      }),
      text: `${condition ?? 'A condition'} has been fulfilled for escrow ${escrowDetails.escrowId ?? 'unknown'}.`,
    };
  }

  private renderConditionConfirmed(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const condition = this.readString(payload, 'condition');
    const subject = `Condition confirmed for escrow ${escrowDetails.escrowId ?? ''}`;
    return {
      subject,
      html: this.render('condition-confirmed', {
        condition,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', { label: 'View Details', url: actionUrl })
          : '',
      }),
      text: `${condition ?? 'A condition'} has been confirmed for escrow ${escrowDetails.escrowId ?? 'unknown'}.`,
    };
  }

  private renderExpirationWarning(
    payload: Record<string, unknown>,
    escrowDetails: EscrowDetailsData,
    actionUrl: string | null,
  ): EmailRenderResult {
    const expiresAt = this.readString(payload, 'expiresAt');
    const subject = `Escrow expiring in 24h: ${escrowDetails.escrowId ?? ''}`;
    return {
      subject,
      html: this.render('expiration-warning', {
        escrowDetails: this.renderPartial('escrow-details', {
          ...escrowDetails,
          status: 'Expiring',
          statusColor: '#ca8a04',
        }),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', {
              label: 'Take Action',
              url: actionUrl,
            })
          : '',
        expiresAt,
      }),
      text: `Escrow ${escrowDetails.escrowId ?? 'unknown'} will expire in approximately 24 hours${expiresAt ? ` (at ${expiresAt})` : ''}.`,
    };
  }

  private renderGenericNotification(
    eventType: NotificationEventType,
    payload: Record<string, unknown>,
    actionUrl: string | null,
  ): EmailRenderResult {
    const escrowDetails = this.buildEscrowDetails(payload);
    const message = `A notification has been received for event: ${eventType}`;
    const subject = `${this.appName} notification: ${eventType}`;
    return {
      subject,
      html: this.render('escrow-status-change', {
        heading: 'Notification',
        message,
        escrowDetails: this.renderPartial('escrow-details', escrowDetails),
        actionUrl,
        buttonHtml: actionUrl
          ? this.renderPartial('button', { label: 'View Details', url: actionUrl })
          : '',
      }),
      text: message,
    };
  }

  private renderPartial(
    partialName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any>,
  ): string {
    const compiled = this.compiledPartials.get(partialName);
    if (!compiled) {
      this.logger.warn(`Partial "${partialName}" not found, returning empty`);
      return '';
    }
    return compiled(data);
  }

  private registerHelpers(): void {
    Handlebars.registerHelper('ifEquals', function (
      this: unknown,
      arg1: unknown,
      arg2: unknown,
      options: Handlebars.HelperOptions,
    ) {
      return arg1 === arg2 ? options.fn(this) : options.inverse(this);
    });
  }

  private loadPartials(): void {
    const partialsDir = path.join(this.templatesDir, 'partials');
    if (!fs.existsSync(partialsDir)) {
      this.logger.warn('Partials directory not found');
      return;
    }

    const files = fs.readdirSync(partialsDir).filter((f) => f.endsWith('.hbs'));
    for (const file of files) {
      const name = file.replace('.hbs', '');
      const content = fs.readFileSync(path.join(partialsDir, file), 'utf-8');
      const compiled = Handlebars.compile(content, { noEscape: true });
      this.compiledPartials.set(name, compiled);
      Handlebars.registerPartial(name, compiled);
    }
  }

  private loadTemplates(): void {
    if (!fs.existsSync(this.templatesDir)) {
      this.logger.error(`Templates directory not found: ${this.templatesDir}`);
      return;
    }

    const files = fs.readdirSync(this.templatesDir).filter((f) => f.endsWith('.hbs'));
    for (const file of files) {
      const name = file.replace('.hbs', '');
      const content = fs.readFileSync(
        path.join(this.templatesDir, file),
        'utf-8',
      );
      this.compiledTemplates.set(name, Handlebars.compile(content, { noEscape: true }));
    }

    const layoutPath = path.join(this.templatesDir, 'base.hbs');
    if (fs.existsSync(layoutPath)) {
      const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
      this.baseLayout = Handlebars.compile(layoutContent, { noEscape: true });
    }
  }

  private buildEscrowDetails(
    payload: Record<string, unknown>,
  ): EscrowDetailsData {
    const status = this.readString(payload, 'status');
    const statusColorMap: Record<string, string> = {
      created: '#6366f1',
      pending: '#6366f1',
      funded: '#3b82f6',
      active: '#3b82f6',
      completed: '#22c55e',
      cancelled: '#ef4444',
      expired: '#f59e0b',
      disputed: '#ef4444',
      resolved: '#22c55e',
    };

    return {
      escrowId: this.readString(payload, 'escrowId') ?? undefined,
      escrowTitle: this.readString(payload, 'escrowTitle') ?? undefined,
      amount: this.readString(payload, 'amount') ?? undefined,
      asset: this.readString(payload, 'asset') ?? 'XLM',
      status: status ?? undefined,
      statusColor: status
        ? (statusColorMap[status.toLowerCase()] ?? '#6366f1')
        : undefined,
    };
  }

  private readString(
    payload: Record<string, unknown>,
    key: string,
  ): string | null {
    const value = payload[key];
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private buildVerificationText(data: {
    code: string;
    expiresIn: string;
  }): string {
    return `Verify your ${this.appName} email address\n\nYour verification code is: ${data.code}\n\nThis code expires in ${data.expiresIn}.\n\nIf you didn't create a ${this.appName} account, you can safely ignore this email.`;
  }

  private buildPasswordResetText(data: {
    actionUrl: string;
    expiresIn: string;
  }): string {
    return `Reset your ${this.appName} password\n\nWe received a request to reset the password for your ${this.appName} account.\n\nReset your password: ${data.actionUrl}\n\nThis link expires in ${data.expiresIn}.\n\nIf you didn't request a password reset, you can safely ignore this email.`;
  }

  private buildEscrowInvitationText(
    payload: Record<string, unknown>,
    role: string,
  ): string {
    const escrowTitle = this.readString(payload, 'escrowTitle') ?? 'Escrow';
    const escrowId = this.readString(payload, 'escrowId') ?? 'unknown';
    const amount = this.readString(payload, 'amount');
    const asset = this.readString(payload, 'asset');
    const actionUrl = this.readString(payload, 'actionUrl');

    let text = `You've been invited to participate as ${role} in escrow "${escrowTitle}" (${escrowId}).`;
    if (amount) text += ` Amount: ${amount} ${asset ?? 'XLM'}.`;
    if (actionUrl) text += `\n\nReview details: ${actionUrl}`;
    return text;
  }
}
