import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import helmet from 'helmet';
import * as express from 'express';
import { AppModule } from './app.module';
import { ApiVersionMiddleware } from './middleware/api-version.middleware';
import { RequestLoggingMiddleware } from './middleware/request-logging.middleware';
import {
  EscrowV2Controller,
  AuthV2Controller,
  NotificationsV2Controller,
} from './modules/versioning/v2-scaffold.controller';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // URI versioning — all routes become /v1/...
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // CORS configuration — origins configurable via CORS_ORIGINS env var
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (server-to-server, curl, mobile apps)
      if (
        !origin ||
        corsOrigins.includes(origin) ||
        corsOrigins.includes('*')
      ) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Accept',
      'Authorization',
      'X-Requested-With',
    ],
  });

  // Security headers via helmet (applied first for all responses)
  app.use(
    helmet({
      // X-Frame-Options: DENY — prevents clickjacking
      frameguard: { action: 'deny' },
      // X-Content-Type-Options: nosniff — prevents MIME-type sniffing
      noSniff: true,
      // Strict-Transport-Security (HSTS) — enforce HTTPS in production
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: false,
      },
      // Referrer-Policy: strict-origin-when-cross-origin
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      // X-XSS-Protection: 0 — modern browsers use CSP instead
      xssFilter: false,
      // Content-Security-Policy — API-only server, no HTML serving
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          imgSrc: ["'self'"],
          connectSrc: ["'self'"],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
      // Disable crossOriginEmbedderPolicy for API-only server
      crossOriginEmbedderPolicy: false,
      // Disable crossOriginOpenerPolicy for API-only server
      crossOriginOpenerPolicy: false,
      // Disable crossOriginResourcePolicy for API-only server
      crossOriginResourcePolicy: false,
      // Disable originAgentCluster for API-only server
      originAgentCluster: false,
      // Disable permittedCrossDomainPolicies for API-only server
      permittedCrossDomainPolicies: false,
    }),
  );

  // Body size limit enforcement (10MB)
  app.use(express.json({ limit: '10mb' }));

  // Request logging with correlation IDs (applied before API version middleware)
  const requestLoggingMiddleware = new RequestLoggingMiddleware();
  app.use(requestLoggingMiddleware.use.bind(requestLoggingMiddleware));

  // API version negotiation middleware
  // Rewrites unversioned requests to /v1/... and adds Sunset headers
  const apiVersionMiddleware = new ApiVersionMiddleware();
  app.use(apiVersionMiddleware.use.bind(apiVersionMiddleware));

  // Enable global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger UI with version selector
  // v1 document (current stable API)
  const v1Config = new DocumentBuilder()
    .setTitle('Vaultix Backend API')
    .setDescription('Vaultix backend endpoints - Version 1 (stable)')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const v1Document = SwaggerModule.createDocument(app, v1Config);

  // v2 document (scaffold / preview)
  const v2Config = new DocumentBuilder()
    .setTitle('Vaultix Backend API')
    .setDescription(
      'Vaultix backend endpoints - Version 2 (scaffold, not yet implemented)',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .build();

  const v2Document = SwaggerModule.createDocument(app, v2Config, {
    include: [EscrowV2Controller, AuthV2Controller, NotificationsV2Controller],
  });

  SwaggerModule.setup('api/docs', app, v1Document, {
    swaggerOptions: {
      urls: [
        { url: '/api/docs-json/v1', name: 'v1 (current)' },
        { url: '/api/docs-json/v2', name: 'v2 (scaffold)' },
      ],
    },
  });

  // Serve versioned JSON documents
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get(
    '/api/docs-json/v1',
    (_req: unknown, res: { json: (doc: unknown) => void }) => {
      res.json(v1Document);
    },
  );
  httpAdapter.get(
    '/api/docs-json/v2',
    (_req: unknown, res: { json: (doc: unknown) => void }) => {
      res.json(v2Document);
    },
  );

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
