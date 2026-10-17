import {
  BadRequestException,
  Controller,
  Get,
  Header,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { EmailTemplatesService } from '../../../email/email-templates.service';
import {
  EMAIL_TEMPLATE_NAMES,
  EmailTemplateName,
  isEmailTemplateName,
} from '../../../email/email.types';

/**
 * Admin-only preview for the Vaultix email templates.
 *
 * - Guarded by the existing AuthGuard + AdminGuard (never public).
 * - Rendering only: previewing never queues or sends a real email.
 * - Only allowlisted template names are accepted; no caller-supplied HTML
 *   is ever rendered and only synthetic example data is used.
 */
@Controller('admin/email-templates')
@UseGuards(AuthGuard, AdminGuard)
export class AdminEmailPreviewController {
  constructor(
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {}

  @Get()
  listTemplates(): { templates: readonly EmailTemplateName[] } {
    return { templates: EMAIL_TEMPLATE_NAMES };
  }

  @Get('preview')
  @Header('Cache-Control', 'no-store')
  previewTemplate(
    @Query('template') template?: string,
    @Query('format') format = 'json',
  ): unknown {
    if (!isEmailTemplateName(template)) {
      throw new BadRequestException(
        `Unknown email template: ${template ?? ''}. Supported templates: ${EMAIL_TEMPLATE_NAMES.join(', ')}`,
      );
    }
    if (format !== 'json' && format !== 'html') {
      throw new BadRequestException(
        `Unsupported preview format: ${format}. Use "json" or "html".`,
      );
    }

    const rendered = this.emailTemplatesService.renderPreview(template);

    if (format === 'html') {
      return rendered.html;
    }
    return {
      template,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    };
  }
}
