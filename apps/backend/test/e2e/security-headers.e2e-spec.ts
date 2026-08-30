import { NestFactory } from '@nestjs/core';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';

// Minimal controller to provide a testable endpoint
@Controller()
class PingController {
  @Get()
  ping() {
    return { ok: true };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [PingController],
})
class MinimalTestModule {}

const helmetConfig = {
  frameguard: { action: 'deny' as const },
  noSniff: true,
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: false },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
  xssFilter: false,
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
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: false,
  crossOriginResourcePolicy: false,
  originAgentCluster: false,
  permittedCrossDomainPolicies: false,
};

describe('Security Headers (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await NestFactory.create(MinimalTestModule, {
      logger: false,
    });
    app = moduleRef;

    // Apply the same helmet configuration as main.ts
    app.use(helmet(helmetConfig));

    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('should set X-Frame-Options to DENY', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/');
    expect(res.headers['x-frame-options']).toBe('DENY');
  });

  it('should set X-Content-Type-Options to nosniff', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('should set Strict-Transport-Security (HSTS) with includeSubDomains', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/');
    const hsts = res.headers['strict-transport-security'];
    expect(hsts).toBeDefined();
    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
  });

  it('should set Referrer-Policy to strict-origin-when-cross-origin', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/');
    expect(res.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
  });

  it('should set Content-Security-Policy with default-src self', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/');
    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
  });

  it('should not set X-XSS-Protection (modern browsers use CSP)', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/');
    // xssFilter is disabled, so the header should not be present
    expect(res.headers['x-xss-protection']).toBeUndefined();
  });

  it('should set security headers on all API endpoints', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/health');
    expect(res.status).toBe(200);
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
    expect(res.headers['referrer-policy']).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  it('should set CSP directives for frame-src none and object-src none', async () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    const res = await request(server).get('/');
    const csp = res.headers['content-security-policy'];
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
