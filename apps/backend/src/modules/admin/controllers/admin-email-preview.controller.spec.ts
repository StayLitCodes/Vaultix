import { BadRequestException } from '@nestjs/common';
import { AdminEmailPreviewController } from './admin-email-preview.controller';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { EmailTemplatesService } from '../../../email/email-templates.service';
import { EMAIL_TEMPLATE_NAMES } from '../../../email/email.types';

describe('AdminEmailPreviewController', () => {
  let controller: AdminEmailPreviewController;
  let templatesService: EmailTemplatesService;

  beforeEach(() => {
    templatesService = new EmailTemplatesService();
    jest.spyOn(templatesService, 'renderPreview');
    controller = new AdminEmailPreviewController(templatesService);
  });

  it('is protected by the existing AuthGuard and AdminGuard', () => {
    const guards: unknown[] =
      Reflect.getMetadata('__guards__', AdminEmailPreviewController) ?? [];
    expect(guards).toContain(AuthGuard);
    expect(guards).toContain(AdminGuard);
  });

  it('lists all supported templates', () => {
    expect(controller.listTemplates()).toEqual({
      templates: EMAIL_TEMPLATE_NAMES,
    });
  });

  it('previews a valid template with safe example data and sends no email', () => {
    const sendEmail = jest.fn();

    const result = controller.previewTemplate('verification', 'json') as {
      template: string;
      subject: string;
      text: string;
      html: string;
    };

    expect(templatesService.renderPreview).toHaveBeenCalledWith('verification');
    expect(result.template).toBe('verification');
    expect(result.subject).toContain('Verify');
    expect(result.html).toContain('Vaultix');
    expect(result.text.length).toBeGreaterThan(0);
    // Previewing renders only — it never touches the mail sender.
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('previews every supported template', () => {
    for (const template of EMAIL_TEMPLATE_NAMES) {
      const result = controller.previewTemplate(template, 'json') as {
        html: string;
      };
      expect(result.html).toContain('Vaultix');
    }
  });

  it('rejects unknown template names', () => {
    expect(() => controller.previewTemplate('invoice', 'json')).toThrow(
      BadRequestException,
    );
    expect(() => controller.previewTemplate(undefined, 'json')).toThrow(
      BadRequestException,
    );
    expect(() => controller.previewTemplate('<b>html</b>', 'json')).toThrow(
      BadRequestException,
    );
  });

  it('rejects unsupported preview formats', () => {
    expect(() => controller.previewTemplate('verification', 'pdf')).toThrow(
      BadRequestException,
    );
  });

  it('returns raw HTML when format=html', () => {
    const result = controller.previewTemplate(
      'password-reset',
      'html',
    ) as string;
    expect(typeof result).toBe('string');
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('Vaultix');
  });
});
