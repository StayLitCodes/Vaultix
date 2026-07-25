import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../../src/app.module';
import { createTestApp } from '../setup/test-app.factory';
import { Keypair } from 'stellar-sdk';
import { ApiKeyScope } from '../../src/api-key/entities/api-key.entity';

interface ChallengeResponse {
  nonce: string;
  message: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface CreateApiKeyResponse {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  expiresAt: Date | null;
  rateLimitPerMinute: number;
  createdAt: Date;
}

interface ListApiKeyResponse {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: ApiKeyScope[];
  isActive: boolean;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  rateLimitPerMinute: number;
  createdAt: Date;
  updatedAt: Date;
}

describe('ApiKeyController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let testKeypair: Keypair;
  let testWalletAddress: string;
  let accessToken: string;
  let apiKeyId: string;
  let rawApiKey: string;

  beforeAll(async () => {
    app = await createTestApp(undefined, (appInstance) => {
      appInstance.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
    });
    httpServer = app.getHttpServer() as Server;

    // Generate a random keypair for testing
    testKeypair = Keypair.random();
    testWalletAddress = testKeypair.publicKey();

    // Get authentication token
    const challengeResponse = await request(httpServer)
      .post('/auth/challenge')
      .send({ walletAddress: testWalletAddress })
      .expect(200);

    const message = (challengeResponse.body as ChallengeResponse).message;
    const signature = testKeypair.sign(Buffer.from(message)).toString('hex');

    const verifyResponse = await request(httpServer)
      .post('/auth/verify')
      .send({
        signature: signature,
        publicKey: testWalletAddress,
      })
      .expect(200);

    accessToken = (verifyResponse.body as TokenResponse).accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('POST /api-keys', () => {
    it('should create a new API key', async () => {
      const createDto = {
        name: 'Test API Key',
        scopes: [ApiKeyScope.READ_ESCROWS, ApiKeyScope.READ_ANALYTICS],
      };

      const response = await request(httpServer)
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(201);

      const body = response.body as CreateApiKeyResponse;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('key');
      expect(body).toHaveProperty('keyPrefix');
      expect(body.name).toBe(createDto.name);
      expect(body.scopes).toEqual(createDto.scopes);
      expect(body.keyPrefix).toMatch(/^vlt_/);
      expect(body.key).toMatch(/^vlt_/);
      expect(body.rateLimitPerMinute).toBe(200);

      apiKeyId = body.id;
      rawApiKey = body.key;
    });

    it('should create API key with expiration date', async () => {
      const createDto = {
        name: 'Expiring API Key',
        scopes: [ApiKeyScope.READ_ESCROWS],
        expiresAt: '2025-12-31T23:59:59Z',
      };

      const response = await request(httpServer)
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(201);

      const body = response.body as CreateApiKeyResponse;
      expect(body.expiresAt).toBeInstanceOf(Date);
      expect(body.name).toBe(createDto.name);
    });

    it('should fail without authentication', async () => {
      const createDto = {
        name: 'Test API Key',
        scopes: [ApiKeyScope.READ_ESCROWS],
      };

      await request(httpServer)
        .post('/api-keys')
        .send(createDto)
        .expect(401);
    });

    it('should fail with invalid scopes', async () => {
      const createDto = {
        name: 'Test API Key',
        scopes: ['invalid:scope'],
      };

      await request(httpServer)
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(400);
    });

    it('should fail when max active keys reached', async () => {
      // Create 4 more keys to reach the limit of 5
      for (let i = 0; i < 4; i++) {
        await request(httpServer)
          .post('/api-keys')
          .set('Authorization', `Bearer ${accessToken}`)
          .send({
            name: `Key ${i}`,
            scopes: [ApiKeyScope.READ_ESCROWS],
          })
          .expect(201);
      }

      // Try to create the 6th key
      await request(httpServer)
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Too Many Keys',
          scopes: [ApiKeyScope.READ_ESCROWS],
        })
        .expect(400);
    });
  });

  describe('GET /api-keys', () => {
    it('should list all API keys for user', async () => {
      const response = await request(httpServer)
        .get('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as ListApiKeyResponse[];
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThan(0);
      
      // Verify sensitive data is not exposed
      body.forEach((key) => {
        expect(key).not.toHaveProperty('key');
        expect(key).not.toHaveProperty('keyHash');
        expect(key).toHaveProperty('keyPrefix');
        expect(key).toHaveProperty('scopes');
        expect(key).toHaveProperty('isActive');
      });
    });

    it('should fail without authentication', async () => {
      await request(httpServer)
        .get('/api-keys')
        .expect(401);
    });
  });

  describe('GET /api-keys/:id', () => {
    it('should get a single API key', async () => {
      const response = await request(httpServer)
        .get(`/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as ListApiKeyResponse;
      expect(body.id).toBe(apiKeyId);
      expect(body).not.toHaveProperty('key');
      expect(body).not.toHaveProperty('keyHash');
      expect(body).toHaveProperty('keyPrefix');
    });

    it('should fail for non-existent key', async () => {
      await request(httpServer)
        .get('/api-keys/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(httpServer)
        .get(`/api-keys/${apiKeyId}`)
        .expect(401);
    });
  });

  describe('PATCH /api-keys/:id', () => {
    it('should update API key name', async () => {
      const updateDto = {
        name: 'Updated API Key Name',
      };

      const response = await request(httpServer)
        .patch(`/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(200);

      const body = response.body as ListApiKeyResponse;
      expect(body.name).toBe(updateDto.name);
    });

    it('should update API key scopes', async () => {
      const updateDto = {
        scopes: [ApiKeyScope.READ_ESCROWS, ApiKeyScope.WRITE_ESCROWS],
      };

      const response = await request(httpServer)
        .patch(`/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(200);

      const body = response.body as ListApiKeyResponse;
      expect(body.scopes).toEqual(updateDto.scopes);
    });

    it('should deactivate API key', async () => {
      const updateDto = {
        isActive: false,
      };

      const response = await request(httpServer)
        .patch(`/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateDto)
        .expect(200);

      const body = response.body as ListApiKeyResponse;
      expect(body.isActive).toBe(false);
    });

    it('should fail for non-existent key', async () => {
      await request(httpServer)
        .patch('/api-keys/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(httpServer)
        .patch(`/api-keys/${apiKeyId}`)
        .send({ name: 'Updated' })
        .expect(401);
    });
  });

  describe('POST /api-keys/:id/rotate', () => {
    it('should rotate API key and return new key', async () => {
      // First reactivate the key for rotation
      await request(httpServer)
        .patch(`/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ isActive: true })
        .expect(200);

      const response = await request(httpServer)
        .post(`/api-keys/${apiKeyId}/rotate`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(201);

      const body = response.body as CreateApiKeyResponse;
      expect(body).toHaveProperty('key');
      expect(body).toHaveProperty('keyPrefix');
      expect(body.key).not.toBe(rawApiKey);
      expect(body.name).toBe('Test API Key');
      expect(body.scopes).toContain(ApiKeyScope.READ_ESCROWS);

      // Update for subsequent tests
      rawApiKey = body.key;
      apiKeyId = body.id;
    });

    it('should fail for non-existent key', async () => {
      await request(httpServer)
        .post('/api-keys/non-existent-id/rotate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(httpServer)
        .post(`/api-keys/${apiKeyId}/rotate`)
        .expect(401);
    });
  });

  describe('DELETE /api-keys/:id', () => {
    it('should revoke API key', async () => {
      const response = await request(httpServer)
        .delete(`/api-keys/${apiKeyId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as ListApiKeyResponse;
      expect(body.isActive).toBe(false);
      expect(body).toHaveProperty('revokedAt');
    });

    it('should fail for non-existent key', async () => {
      await request(httpServer)
        .delete('/api-keys/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should fail without authentication', async () => {
      await request(httpServer)
        .delete(`/api-keys/${apiKeyId}`)
        .expect(401);
    });
  });

  describe('API Key Authentication', () => {
    let testApiKey: string;
    let testApiKeyId: string;

    beforeAll(async () => {
      // Create a fresh API key for authentication tests
      const createDto = {
        name: 'Auth Test Key',
        scopes: [ApiKeyScope.READ_ESCROWS],
      };

      const response = await request(httpServer)
        .post('/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(createDto)
        .expect(201);

      const body = response.body as CreateApiKeyResponse;
      testApiKey = body.key;
      testApiKeyId = body.id;
    });

    it('should authenticate using X-API-Key header', async () => {
      const response = await request(httpServer)
        .get('/api-keys')
        .set('X-API-Key', testApiKey)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should fail with invalid API key', async () => {
      await request(httpServer)
        .get('/api-keys')
        .set('X-API-Key', 'invalid-key')
        .expect(401);
    });

    it('should fail without API key or JWT', async () => {
      await request(httpServer)
        .get('/api-keys')
        .expect(401);
    });

    it('should include rate limit headers', async () => {
      const response = await request(httpServer)
        .get('/api-keys')
        .set('X-API-Key', testApiKey)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });

    it('should enforce rate limiting', async () => {
      // Make 200 requests to hit the rate limit
      const requests = Array(200).fill(null).map(() =>
        request(httpServer)
          .get('/api-keys')
          .set('X-API-Key', testApiKey)
      );

      await Promise.all(requests);

      // Next request should be rate limited
      await request(httpServer)
        .get('/api-keys')
        .set('X-API-Key', testApiKey)
        .expect(429);
    });

    afterAll(async () => {
      // Clean up test API key
      await request(httpServer)
        .delete(`/api-keys/${testApiKeyId}`)
        .set('Authorization', `Bearer ${accessToken}`);
    });
  });
});