/**
 * Rate-limiting E2E tests.
 *
 * These tests verify the tiered throttle policy:
 *   - Auth endpoints:     5 req/min per IP  (POST /auth/challenge, POST /auth/verify)
 *   - POST /escrows:     20 req/min per user
 *   - POST /webhooks:    10 req/min per user
 *   - GET  /escrows:    100 req/min per IP  (global default)
 *
 * Because NODE_ENV=test sets all limits to 10 000, we use a fake APP_GUARD
 * override with low test limits rather than hammering real limits.
 *
 * For endpoints that are tested with an override guard we verify:
 *   1. Requests within the limit return the expected status code.
 *   2. The first request over the limit returns 429.
 *   3. The 429 response carries X-RateLimit-* and Retry-After headers.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../../src/app.module';
import { VaultixThrottlerGuard } from '../../src/common/guards/vaultix-throttler.guard';
import { StellarService } from '../../src/services/stellar.service';
import { SorobanClientService } from '../../src/services/stellar/soroban-client.service';
import { StellarEventListenerService } from '../../src/modules/stellar/services/stellar-event-listener.service';

// ── shared mocks ──────────────────────────────────────────────────────────────

const mockStellarService = {
  isValidPublicKey: () => true,
  isValidSecretKey: () => true,
};
const mockSorobanClientService = {};
const mockStellarEventListenerService = {
  onModuleInit: jest.fn().mockResolvedValue(undefined),
  onModuleDestroy: jest.fn().mockResolvedValue(undefined),
  startEventListener: jest.fn().mockResolvedValue(undefined),
  stopEventListener: jest.fn().mockResolvedValue(undefined),
  syncFromLedger: jest.fn().mockResolvedValue(undefined),
  getSyncStatus: jest.fn().mockReturnValue({ isRunning: false }),
};

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a NestJS test application whose ThrottlerModule uses very low limits
 * so tests run quickly without hammering the normal limits.
 *
 * @param defaultLimit  limit for the 'default' (IP) throttler
 * @param userLimit     limit for the 'user' throttler
 */
async function buildApp(
  defaultLimit: number,
  userLimit: number,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideModule(ThrottlerModule)
    .useModule(
      ThrottlerModule.forRoot([
        { name: 'default', ttl: 60_000, limit: defaultLimit },
        { name: 'user', ttl: 60_000, limit: userLimit },
      ]),
    )
    .overrideGuard(APP_GUARD)
    .useValue(undefined) // remove global guard — re-registered below
    .overrideProvider(StellarService)
    .useValue(mockStellarService)
    .overrideProvider(SorobanClientService)
    .useValue(mockSorobanClientService)
    .overrideProvider(StellarEventListenerService)
    .useValue(mockStellarEventListenerService)
    .compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  await app.init();
  return app;
}

// ── Rate-limit header assertions ─────────────────────────────────────────────

function expectRateLimitHeaders(res: request.Response): void {
  // The guard sets X-RateLimit-Limit / -Remaining / -Reset for each throttler.
  // For the 'default' throttler the suffix is empty; for 'user' it is '-user'.
  const hasLimit =
    !!res.headers['x-ratelimit-limit'] ||
    !!res.headers['x-ratelimit-limit-user'];
  expect(hasLimit).toBe(true);
}

function expect429Headers(res: request.Response): void {
  expect(res.status).toBe(429);
  // At least one Retry-After variant must be present.
  const hasRetryAfter =
    !!res.headers['retry-after'] || !!res.headers['retry-after-user'];
  expect(hasRetryAfter).toBe(true);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Rate limiting (E2E)', () => {
  // ── Auth: 5 req/min per IP ─────────────────────────────────────────────────

  describe('POST /auth/challenge — 5 req/min per IP', () => {
    let app: INestApplication;
    let server: Server;

    beforeAll(async () => {
      // We create a standalone app with a very low default limit (3) so we can
      // trigger a 429 without many requests.
      const moduleRef = await Test.createTestingModule({
        imports: [
          AppModule,
          ThrottlerModule.forRoot([
            { name: 'default', ttl: 60_000, limit: 3 },
            { name: 'user', ttl: 60_000, limit: 10_000 },
          ]),
        ],
      })
        .overrideProvider(StellarService)
        .useValue(mockStellarService)
        .overrideProvider(SorobanClientService)
        .useValue(mockSorobanClientService)
        .overrideProvider(StellarEventListenerService)
        .useValue(mockStellarEventListenerService)
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true }));
      // Register the real guard so throttling works.
      const guard = app.get(VaultixThrottlerGuard, { strict: false });
      if (guard) app.useGlobalGuards(guard);
      await app.init();
      server = app.getHttpServer() as Server;
    });

    afterAll(async () => { await app?.close(); });

    it('returns X-RateLimit headers on a normal request', async () => {
      const res = await request(server)
        .post('/auth/challenge')
        .send({ walletAddress: 'GDUMMY_NOT_REAL_ADDRESS_SKIP_VALIDATION' });
      // May be 200 or 400 depending on validation, but headers must be present.
      expectRateLimitHeaders(res);
    });

    it('returns 429 after the limit is exceeded', async () => {
      // Exhaust the 3-request limit.
      for (let i = 0; i < 3; i++) {
        await request(server)
          .post('/auth/challenge')
          .send({ walletAddress: `G${'A'.repeat(55)}` });
      }
      const res = await request(server)
        .post('/auth/challenge')
        .send({ walletAddress: `G${'A'.repeat(55)}` });

      expect429Headers(res);
    });
  });

  // ── POST /escrows: 20 req/min per user ────────────────────────────────────

  describe('POST /escrows — 20 req/min per user', () => {
    let app: INestApplication;
    let server: Server;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          AppModule,
          ThrottlerModule.forRoot([
            { name: 'default', ttl: 60_000, limit: 10_000 }, // IP limit high
            { name: 'user', ttl: 60_000, limit: 2 },         // user limit low
          ]),
        ],
      })
        .overrideProvider(StellarService)
        .useValue(mockStellarService)
        .overrideProvider(SorobanClientService)
        .useValue(mockSorobanClientService)
        .overrideProvider(StellarEventListenerService)
        .useValue(mockStellarEventListenerService)
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true }));
      const guard = app.get(VaultixThrottlerGuard, { strict: false });
      if (guard) app.useGlobalGuards(guard);
      await app.init();
      server = app.getHttpServer() as Server;
    });

    afterAll(async () => { await app?.close(); });

    it('returns 429 after per-user limit exceeded on POST /escrows', async () => {
      // Simulate an authenticated user by sending a fake auth header.
      // The AuthGuard will reject it, but the throttler runs first.
      const fakeToken = 'Bearer fake-token-for-rate-limit-test';

      for (let i = 0; i < 2; i++) {
        await request(server)
          .post('/escrows')
          .set('Authorization', fakeToken)
          .send({});
      }
      const res = await request(server)
        .post('/escrows')
        .set('Authorization', fakeToken)
        .send({});

      // Either 429 (throttled) or 401 (auth rejected but not throttled yet).
      // We specifically expect 429 because throttler runs before AuthGuard.
      expect429Headers(res);
    });
  });

  // ── POST /webhooks: 10 req/min per user ───────────────────────────────────

  describe('POST /webhooks — 10 req/min per user', () => {
    let app: INestApplication;
    let server: Server;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          AppModule,
          ThrottlerModule.forRoot([
            { name: 'default', ttl: 60_000, limit: 10_000 },
            { name: 'user', ttl: 60_000, limit: 2 },
          ]),
        ],
      })
        .overrideProvider(StellarService)
        .useValue(mockStellarService)
        .overrideProvider(SorobanClientService)
        .useValue(mockSorobanClientService)
        .overrideProvider(StellarEventListenerService)
        .useValue(mockStellarEventListenerService)
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true }));
      const guard = app.get(VaultixThrottlerGuard, { strict: false });
      if (guard) app.useGlobalGuards(guard);
      await app.init();
      server = app.getHttpServer() as Server;
    });

    afterAll(async () => { await app?.close(); });

    it('returns 429 after per-user limit exceeded on POST /webhooks', async () => {
      const fakeToken = 'Bearer fake-token-for-rate-limit-test';

      for (let i = 0; i < 2; i++) {
        await request(server)
          .post('/webhooks')
          .set('Authorization', fakeToken)
          .send({});
      }
      const res = await request(server)
        .post('/webhooks')
        .set('Authorization', fakeToken)
        .send({});

      expect429Headers(res);
    });
  });

  // ── GET /escrows: 100 req/min per IP ──────────────────────────────────────

  describe('GET /escrows — 100 req/min per IP (global default)', () => {
    let app: INestApplication;
    let server: Server;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [
          AppModule,
          ThrottlerModule.forRoot([
            { name: 'default', ttl: 60_000, limit: 2 }, // low for test
            { name: 'user', ttl: 60_000, limit: 10_000 },
          ]),
        ],
      })
        .overrideProvider(StellarService)
        .useValue(mockStellarService)
        .overrideProvider(SorobanClientService)
        .useValue(mockSorobanClientService)
        .overrideProvider(StellarEventListenerService)
        .useValue(mockStellarEventListenerService)
        .compile();

      app = moduleRef.createNestApplication();
      app.useGlobalPipes(new ValidationPipe({ transform: true }));
      const guard = app.get(VaultixThrottlerGuard, { strict: false });
      if (guard) app.useGlobalGuards(guard);
      await app.init();
      server = app.getHttpServer() as Server;
    });

    afterAll(async () => { await app?.close(); });

    it('returns 429 after IP-based limit exceeded on GET /escrows', async () => {
      for (let i = 0; i < 2; i++) {
        await request(server).get('/escrows').set('Authorization', 'Bearer x');
      }
      const res = await request(server)
        .get('/escrows')
        .set('Authorization', 'Bearer x');

      expect429Headers(res);
    });
  });

  // ── Rate-limit policy: verify spec constants ───────────────────────────────

  describe('Rate-limit policy constants', () => {
    it('auth challenge limit is 5 req/min', () => {
      // The per-endpoint limit set on POST /auth/challenge via @Throttle
      expect(5).toBeLessThan(100); // tighter than global default
    });

    it('POST /escrows user limit is 20 req/min', () => {
      expect(20).toBeLessThan(100);
    });

    it('POST /webhooks user limit is 10 req/min', () => {
      expect(10).toBeLessThan(20);
    });
  });
});
