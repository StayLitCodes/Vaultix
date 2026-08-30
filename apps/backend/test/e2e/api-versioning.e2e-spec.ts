import { NestFactory } from '@nestjs/core';
import {
  Controller,
  Get,
  INestApplication,
  Module,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { ApiVersionMiddleware } from '../../src/middleware/api-version.middleware';

// Minimal test controllers using real API path prefixes
@Controller({ path: 'escrows', version: '1' })
class TestV1Controller {
  @Get()
  getV1() {
    return { version: 'v1', message: 'Hello from v1' };
  }

  @Get('items')
  getItems() {
    return { version: 'v1', items: ['item1', 'item2'] };
  }
}

@Controller({ path: 'escrows', version: '2' })
class TestV2Controller {
  @Get()
  getV2() {
    return { version: 'v2', message: 'Hello from v2', data: [], meta: {} };
  }
}

@Controller({ path: 'health', version: '1' })
class HealthV1Controller {
  @Get()
  getHealth() {
    return { status: 'ok' };
  }
}

@Module({
  controllers: [TestV1Controller, TestV2Controller, HealthV1Controller],
})
class VersioningTestModule {}

describe('API Versioning (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await NestFactory.create(VersioningTestModule, {
      logger: false,
    });

    // Enable URI versioning like main.ts
    moduleRef.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    // Apply the version middleware
    const middleware = new ApiVersionMiddleware();
    moduleRef.use(middleware.use.bind(middleware));

    app = moduleRef;
    await app.init();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('Versioned URLs (/v1/...)', () => {
    it('should serve v1 endpoints at /v1/escrows', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/v1/escrows');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ version: 'v1', message: 'Hello from v1' });
    });

    it('should set X-API-Version header for versioned requests', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/v1/escrows');
      expect(res.headers['x-api-version']).toBe('v1');
    });

    it('should serve v1 sub-routes at /v1/escrows/items', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/v1/escrows/items');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ version: 'v1', items: ['item1', 'item2'] });
    });

    it('should serve v2 endpoints at /v2/escrows', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/v2/escrows');
      expect(res.status).toBe(200);
      expect(res.body.version).toBe('v2');
    });

    it('should set X-API-Version v2 for v2 requests', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/v2/escrows');
      expect(res.headers['x-api-version']).toBe('v2');
    });
  });

  describe('Unversioned URLs (backward compatibility)', () => {
    it('should rewrite unversioned /escrows to /v1/escrows and return 200', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/escrows');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ version: 'v1', message: 'Hello from v1' });
    });

    it('should add Sunset header for unversioned requests', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/escrows');
      expect(res.headers['sunset']).toBeDefined();
      expect(res.headers['sunset']).toBeTruthy();
    });

    it('should add X-API-Version header for unversioned requests', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/escrows');
      expect(res.headers['x-api-version']).toBe('v1');
    });

    it('should add Link header pointing to successor version', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/escrows');
      expect(res.headers['link']).toContain('/v1/escrows');
      expect(res.headers['link']).toContain('successor-version');
    });

    it('should rewrite unversioned /escrows/items to /v1/escrows/items', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/escrows/items');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ version: 'v1', items: ['item1', 'item2'] });
    });
  });

  describe('Version-neutral endpoints', () => {
    it('should serve versioned health endpoint at /v1/health', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('Unknown versions', () => {
    it('should return 404 for non-existent v99 endpoints', async () => {
      const server = app.getHttpServer();
      const res = await request(server).get('/v99/escrows');
      // v99 is not registered, so NestJS returns 404
      expect(res.status).toBe(404);
    });
  });
});
