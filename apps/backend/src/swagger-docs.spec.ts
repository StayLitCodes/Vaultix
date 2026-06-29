import { readFileSync } from 'fs';
import { join } from 'path';

describe('Swagger documentation coverage', () => {
  const read = (relativePath: string) =>
    readFileSync(join(__dirname, relativePath), 'utf8');

  it('documents the core backend controllers and DTOs', () => {
    const controllerFiles = [
      ['modules/escrow/controllers/escrow.controller.ts', '@ApiTags('],
      ['modules/auth/controllers/auth.controller.ts', '@ApiTags('],
      ['modules/admin/admin.controller.ts', '@ApiTags('],
      ['modules/assets/assets.controller.ts', '@ApiTags('],
      ['modules/health/health.controller.ts', '@ApiTags('],
      ['modules/webhook/webhook.controller.ts', '@ApiTags('],
      ['notifications/notifications.controller.ts', '@ApiTags('],
    ];

    for (const [relativePath, expectedSnippet] of controllerFiles) {
      const content = read(relativePath);
      expect(content).toContain(expectedSnippet);
      expect(content).toContain('@ApiOperation(');
    }

    const dtoFiles = [
      'modules/escrow/dto/create-escrow.dto.ts',
      'modules/escrow/dto/update-escrow.dto.ts',
      'modules/auth/dto/auth.dto.ts',
      'modules/auth/dto/profile.dto.ts',
      'notifications/entities/update-preferences.dto.ts',
      'modules/assets/dto/asset.dto.ts',
    ];

    for (const relativePath of dtoFiles) {
      const content = read(relativePath);
      expect(content).toContain('@ApiProperty');
    }

    const mainContent = read('main.ts');
    expect(mainContent).toContain("SwaggerModule.setup('api/docs'");
    expect(mainContent).toContain('.addBearerAuth(');
  });
});
