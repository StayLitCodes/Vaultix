import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../src/modules/user/entities/refresh-token.entity';
import { User } from '../src/modules/user/entities/user.entity';
import { Escrow } from '../src/modules/escrow/entities/escrow.entity';
import { Party, PartyRole } from '../src/modules/escrow/entities/party.entity';
import { Condition } from '../src/modules/escrow/entities/condition.entity';
import { EscrowEvent } from '../src/modules/escrow/entities/escrow-event.entity';

// Mock Stellar keypair for testing
interface MockKeypair {
  publicKey: () => string;
  sign: (data: string) => Buffer;
}

function createMockKeypair(): MockKeypair {
  const randomKey =
    'G' +
    Array.from({ length: 55 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.charAt(Math.floor(Math.random() * 32)),
    ).join('');
  return {
    publicKey: () => randomKey,
    sign: (data: string) => Buffer.from(data + '-signed'),
  };
}

describe('Events (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let testKeypair: MockKeypair;
  let testWalletAddress: string;
  let accessToken: string;

  let secondKeypair: MockKeypair;
  let secondWalletAddress: string;
  let secondAccessToken: string;
  let secondUserId: string;

  let escrowId: string;

  beforeAll(async () => {
    testKeypair = createMockKeypair();
    testWalletAddress = testKeypair.publicKey();

    secondKeypair = createMockKeypair();
    secondWalletAddress = secondKeypair.publicKey();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        AppModule,
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [User, RefreshToken, Escrow, Party, Condition, EscrowEvent],
          synchronize: true,
        }),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
    httpServer = app.getHttpServer() as Server;

    // Authenticate first user
    const challengeResponse = await request(httpServer)
      .post('/auth/challenge')
      .send({ walletAddress: testWalletAddress });

    const message = (challengeResponse.body as { message: string }).message;
    const signature = testKeypair.sign(message).toString('hex');

    const verifyResponse = await request(httpServer).post('/auth/verify').send({
      walletAddress: testWalletAddress,
      signature: signature,
      publicKey: testWalletAddress,
    });

    accessToken = (verifyResponse.body as { accessToken: string }).accessToken;

    // Authenticate second user
    const challenge2 = await request(httpServer)
      .post('/auth/challenge')
      .send({ walletAddress: secondWalletAddress });

    const message2 = (challenge2.body as { message: string }).message;
    const signature2 = secondKeypair.sign(message2).toString('hex');

    const verify2 = await request(httpServer).post('/auth/verify').send({
      walletAddress: secondWalletAddress,
      signature: signature2,
      publicKey: secondWalletAddress,
    });

    secondAccessToken = (verify2.body as { accessToken: string }).accessToken;

    const me2 = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${secondAccessToken}`);
    secondUserId = (me2.body as { id: string }).id;

    // Create an escrow for testing
    const escrowResponse = await request(httpServer)
      .post('/escrows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Test Escrow for Events',
        description: 'Test description',
        amount: 100,
        asset: 'XLM',
        parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
      });

    escrowId = (escrowResponse.body as { id: string }).id;
  });

  afterAll(async () => {
    await app.close();
  });

  interface EventResponse {
    id: string;
    escrowId: string;
    eventType: string;
    actorId?: string;
    data?: Record<string, unknown>;
    createdAt: string;
    escrow?: {
      id: string;
      title: string;
      amount: number;
      asset: string;
      status: string;
    };
    actor?: {
      walletAddress?: string;
    };
  }

  interface EventsListResponse {
    data: EventResponse[];
    total: number;
    page: number;
    limit: number;
  }

  describe('GET /events', () => {
    it('should return user events with default pagination', async () => {
      const response = await request(httpServer)
        .get('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('limit');
      expect(body.page).toBe(1);
      expect(body.limit).toBe(10);
    });

    it('should return events with custom pagination', async () => {
      const response = await request(httpServer)
        .get('/events?page=2&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      expect(body.page).toBe(2);
      expect(body.limit).toBe(5);
    });

    it('should filter events by event type', async () => {
      const response = await request(httpServer)
        .get('/events?eventType=created')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].eventType).toBe('created');
    });

    it('should filter events by date range', async () => {
      const now = new Date().toISOString();
      const yesterday = new Date(
        Date.now() - 24 * 60 * 60 * 1000,
      ).toISOString();

      const response = await request(httpServer)
        .get(`/events?dateFrom=${yesterday}&dateTo=${now}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      expect(body.data).toHaveLength(1);
    });

    it('should sort events by createdAt descending by default', async () => {
      const response = await request(httpServer)
        .get('/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      if (body.data.length > 1) {
        const firstEvent = new Date(body.data[0].createdAt);
        const secondEvent = new Date(body.data[1].createdAt);
        expect(firstEvent.getTime()).toBeGreaterThanOrEqual(
          secondEvent.getTime(),
        );
      }
    });

    it('should sort events by createdAt ascending', async () => {
      const response = await request(httpServer)
        .get('/events?sortOrder=ASC')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      if (body.data.length > 1) {
        const firstEvent = new Date(body.data[0].createdAt);
        const secondEvent = new Date(body.data[1].createdAt);
        expect(firstEvent.getTime()).toBeLessThanOrEqual(secondEvent.getTime());
      }
    });

    it('should return 401 without auth token', async () => {
      await request(httpServer).get('/events').expect(401);
    });

    it('should return empty array for user with no events', async () => {
      const thirdKeypair = createMockKeypair();
      const thirdWalletAddress = thirdKeypair.publicKey();

      const challenge3 = await request(httpServer)
        .post('/auth/challenge')
        .send({ walletAddress: thirdWalletAddress });

      const message3 = (challenge3.body as { message: string }).message;
      const signature3 = thirdKeypair.sign(message3).toString('hex');

      const verify3 = await request(httpServer).post('/auth/verify').send({
        walletAddress: thirdWalletAddress,
        signature: signature3,
        publicKey: thirdWalletAddress,
      });

      const thirdAccessToken = (verify3.body as { accessToken: string })
        .accessToken;

      const response = await request(httpServer)
        .get('/events')
        .set('Authorization', `Bearer ${thirdAccessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      expect(body.data).toHaveLength(0);
      expect(body.total).toBe(0);
    });
  });

  describe('GET /escrows/:id/events', () => {
    it('should return events for specific escrow', async () => {
      const response = await request(httpServer)
        .get(`/escrows/${escrowId}/events`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].escrowId).toBe(escrowId);
    });

    it('should return 403 for unauthorized user', async () => {
      const thirdKeypair = createMockKeypair();
      const thirdWalletAddress = thirdKeypair.publicKey();

      const challenge3 = await request(httpServer)
        .post('/auth/challenge')
        .send({ walletAddress: thirdWalletAddress });

      const message3 = (challenge3.body as { message: string }).message;
      const signature3 = thirdKeypair.sign(message3).toString('hex');

      const verify3 = await request(httpServer).post('/auth/verify').send({
        walletAddress: thirdWalletAddress,
        signature: signature3,
        publicKey: thirdWalletAddress,
      });

      const thirdAccessToken = (verify3.body as { accessToken: string })
        .accessToken;

      await request(httpServer)
        .get(`/escrows/${escrowId}/events`)
        .set('Authorization', `Bearer ${thirdAccessToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent escrow', async () => {
      await request(httpServer)
        .get('/escrows/invalid-id/events')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return events with pagination', async () => {
      const response = await request(httpServer)
        .get(`/escrows/${escrowId}/events?page=1&limit=5`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      expect(body.page).toBe(1);
      expect(body.limit).toBe(5);
    });

    it('should include escrow details in response', async () => {
      const response = await request(httpServer)
        .get(`/escrows/${escrowId}/events`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EventsListResponse;
      const event = body.data[0];
      expect(event.escrow).toBeDefined();
      expect(event.escrow?.id).toBe(escrowId);
      expect(event.escrow?.title).toBe('Test Escrow for Events');
    });
  });

  describe('Event Filtering and Validation', () => {
    it('should reject invalid UUID for escrowId', async () => {
      await request(httpServer)
        .get('/events?escrowId=invalid-uuid')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should reject invalid event type', async () => {
      await request(httpServer)
        .get('/events?eventType=invalid_type')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should reject invalid date format', async () => {
      await request(httpServer)
        .get('/events?dateFrom=invalid-date')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should reject invalid pagination values', async () => {
      await request(httpServer)
        .get('/events?page=0&limit=101')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });
});
