import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // URI versioning — all routes become /v1/...
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Vaultix Backend API')
    .setDescription([
      'Vaultix backend endpoints',
      '',
      '## WebSocket events',
      '- `connected`: emitted after successful authentication with `{ userId, socketId }`.',
      '- `joinedEscrow`: emitted after joining an escrow room.',
      '- `escrow:status_changed`: emitted when escrow state changes.',
      '- `escrow:milestone_released`: emitted when a milestone is released.',
      '- `escrow:dispute_filed` / `escrow:dispute_resolved`: emitted for dispute lifecycle updates.',
      '- `notification:new`: emitted to the authenticated user when a notification is published.',
    ].join('\n'))
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token issued by the auth endpoints',
      },
      'access-token',
    )
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'Vaultix API Docs',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
