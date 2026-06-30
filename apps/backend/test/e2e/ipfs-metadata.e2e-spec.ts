import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';

describe('IPFS Metadata Endpoints (Integration)', () => {
  let app: INestApplication;
  let authToken: string;
  let escrowId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Login and get auth token
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123',
      });

    authToken = loginResponse.body.accessToken;

    // Create a test escrow
    const escrowResponse = await request(app.getHttpServer())
      .post('/escrows')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Escrow',
        amount: 100,
        asset: { code: 'XLM' },
        parties: [
          { userId: 'user-1', role: 'buyer' },
          { userId: 'user-2', role: 'seller' },
        ],
        conditions: [
          {
            description: 'Test condition',
            type: 'delivery',
          },
        ],
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });

    escrowId = escrowResponse.body.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /escrows/:id/metadata', () => {
    it('should return 400 when no IPFS metadata exists', () => {
      return request(app.getHttpServer())
        .get(`/escrows/${escrowId}/metadata`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('POST /escrows/:id/metadata/pin', () => {
    it('should pin metadata to IPFS (admin only)', async () => {
      const response = await request(app.getHttpServer())
        .post(`/escrows/${escrowId}/metadata/pin`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('cid');
      expect(response.body).toHaveProperty('metadataHash');
    });

    it('should fail for non-admin users', async () => {
      // Create a non-admin user token
      const nonAdminResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonadmin@example.com',
          password: 'password123',
        });

      const nonAdminToken = nonAdminResponse.body.accessToken;

      await request(app.getHttpServer())
        .post(`/escrows/${escrowId}/metadata/pin`)
        .set('Authorization', `Bearer ${nonAdminToken}`)
        .expect(403);
    });
  });

  describe('GET /escrows/:id/metadata/verify', () => {
    it('should verify metadata integrity after pinning', async () => {
      // First pin the metadata
      await request(app.getHttpServer())
        .post(`/escrows/${escrowId}/metadata/pin`)
        .set('Authorization', `Bearer ${authToken}`);

      // Then verify it
      const response = await request(app.getHttpServer())
        .get(`/escrows/${escrowId}/metadata/verify`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('isValid');
      expect(response.body).toHaveProperty('computedHash');
      expect(response.body).toHaveProperty('storedHash');
      expect(response.body).toHaveProperty('metadata');
    });
  });

  describe('GET /escrows/:id/metadata (after pinning)', () => {
    it('should return metadata from IPFS after pinning', async () => {
      // First pin the metadata
      await request(app.getHttpServer())
        .post(`/escrows/${escrowId}/metadata/pin`)
        .set('Authorization', `Bearer ${authToken}`);

      // Then retrieve it
      const response = await request(app.getHttpServer())
        .get(`/escrows/${escrowId}/metadata`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('escrowId');
      expect(response.body).toHaveProperty('buyer');
      expect(response.body).toHaveProperty('seller');
      expect(response.body).toHaveProperty('amount');
      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('version');
    });
  });
});
