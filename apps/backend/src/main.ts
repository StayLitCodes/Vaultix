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
    .setDescription(
      'Vaultix backend endpoints\n\n' +
        '### Authentication Flow\n' +
        '1. **Request Challenge**: Call `POST /v1/auth/challenge` with your wallet address.\n' +
        '2. **Sign Challenge**: Sign the received challenge string with your Stellar wallet.\n' +
        '3. **Verify Signature**: Call `POST /v1/auth/verify` with the wallet address, signature, and public key.\n' +
        '4. **Authenticate**: Use the received `accessToken` as a Bearer token.\n\n' +
        'To authenticate in Swagger UI, click **Authorize** and enter your `accessToken`.'
    )
    .setVersion('1.0')
    .addBearerAuth({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'Enter your JWT access token from the verify step',
    })
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
