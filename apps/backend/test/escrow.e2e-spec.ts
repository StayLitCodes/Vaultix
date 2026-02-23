import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../src/modules/user/entities/refresh-token.entity';
import { User } from '../src/modules/user/entities/user.entity';
import {
  Escrow,
  EscrowStatus,
  EscrowType,
} from '../src/modules/escrow/entities/escrow.entity';
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

describe('Escrow (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let testKeypair: MockKeypair;
  let testWalletAddress: string;
  let accessToken: string;
  let userId: string;

  let secondKeypair: MockKeypair;
  let secondWalletAddress: string;
  let secondAccessToken: string;
  let secondUserId: string;
  let escrowRepository: Repository<Escrow>;

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
    escrowRepository = app.get(DataSource).getRepository(Escrow);

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

    const meResponse = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    userId = (meResponse.body as { id: string }).id;

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
  });

  afterAll(async () => {
    await app.close();
  });

  interface EscrowResponse {
    id: string;
    title: string;
    amount: number;
    status: string;
    creatorId: string;
    conditions?: { description: string; type: string }[];
  }

  interface EscrowListResponse {
    data: EscrowResponse[];
    total: number;
    page: number;
    limit: number;
  }

  interface EscrowOverviewItem {
    escrowId: string;
    depositor: string;
    recipient: string | null;
    token: string;
    totalAmount: number;
    totalReleased: number;
    remainingAmount: number;
    status: string;
    deadline: string | null;
    createdAt: string;
    updatedAt: string;
  }

  interface EscrowOverviewResponse {
    data: EscrowOverviewItem[];
    totalItems: number;
    totalPages: number;
    page: number;
    pageSize: number;
  }

  describe('POST /escrows', () => {
    it('should create an escrow', async () => {
      const response = await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test Escrow',
          description: 'Test description',
          amount: 100,
          asset: 'XLM',
          parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
        })
        .expect(201);

      const body = response.body as EscrowResponse;
      expect(body).toHaveProperty('id');
      expect(body.title).toBe('Test Escrow');
      expect(body.amount).toBe(100);
      expect(body.status).toBe('pending');
      expect(body.creatorId).toBe(userId);
    });

    it('should create an escrow with conditions', async () => {
      const response = await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Escrow with Conditions',
          amount: 200,
          parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
          conditions: [
            { description: 'Goods delivered', type: 'manual' },
            { description: 'Inspection passed', type: 'manual' },
          ],
        })
        .expect(201);

      const body = response.body as EscrowResponse;
      expect(body.conditions).toHaveLength(2);
    });

    it('should return 400 for invalid data', async () => {
      await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Test',
          // missing required fields
        })
        .expect(400);
    });

    it('should return 401 without auth token', async () => {
      await request(httpServer)
        .post('/escrows')
        .send({
          title: 'Test Escrow',
          amount: 100,
          parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
        })
        .expect(401);
    });
  });

  describe('GET /escrows', () => {
    it('should return user escrows', async () => {
      const response = await request(httpServer)
        .get('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EscrowListResponse;
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('total');
      expect(body).toHaveProperty('page');
      expect(body).toHaveProperty('limit');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(httpServer)
        .get('/escrows?page=1&limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EscrowListResponse;
      expect(body.page).toBe(1);
      expect(body.limit).toBe(5);
    });

    it('should filter by status', async () => {
      const response = await request(httpServer)
        .get('/escrows?status=pending')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EscrowListResponse;
      body.data.forEach((escrow: EscrowResponse) => {
        expect(escrow.status).toBe('pending');
      });
    });

    it('should return 401 without auth token', async () => {
      await request(httpServer).get('/escrows').expect(401);
    });
  });

  describe('GET /escrows/overview', () => {
    async function createOverviewEscrow(params: {
      title: string;
      amount?: number;
      asset?: string;
      expiresAt?: string;
    }): Promise<string> {
      const response = await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: params.title,
          amount: params.amount ?? 100,
          asset: params.asset ?? 'XLM',
          type: EscrowType.STANDARD,
          expiresAt: params.expiresAt,
          parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
        })
        .expect(201);

      return (response.body as EscrowResponse).id;
    }

    it('should filter by role and status', async () => {
      const pendingId = await createOverviewEscrow({
        title: 'Overview Pending Escrow',
      });
      const completedId = await createOverviewEscrow({
        title: 'Overview Completed Escrow',
      });

      await escrowRepository.update(completedId, {
        status: EscrowStatus.COMPLETED,
        isReleased: true,
      });

      const depositorCompletedResponse = await request(httpServer)
        .get('/escrows/overview?role=depositor&status=completed')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const depositorCompletedBody =
        depositorCompletedResponse.body as EscrowOverviewResponse;
      const completedEscrow = depositorCompletedBody.data.find(
        (item) => item.escrowId === completedId,
      );

      expect(completedEscrow).toBeDefined();
      expect(completedEscrow?.status).toBe('completed');
      expect(completedEscrow?.depositor).toBe(userId);
      expect(completedEscrow?.recipient).toBe(secondUserId);
      expect(completedEscrow?.totalReleased).toBe(completedEscrow?.totalAmount);
      expect(completedEscrow?.remainingAmount).toBe(0);
      expect(
        depositorCompletedBody.data.some((item) => item.escrowId === pendingId),
      ).toBe(false);

      const recipientPendingResponse = await request(httpServer)
        .get('/escrows/overview?role=recipient&status=created')
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .expect(200);

      const recipientPendingBody =
        recipientPendingResponse.body as EscrowOverviewResponse;
      expect(
        recipientPendingBody.data.some((item) => item.escrowId === pendingId),
      ).toBe(true);
      recipientPendingBody.data.forEach((item) => {
        expect(item.status).toBe('pending');
        expect(item.recipient).toBe(secondUserId);
      });
    });

    it('should return accurate pagination metadata and handle out-of-range pages', async () => {
      await createOverviewEscrow({ title: 'Overview Pagination 1' });
      await createOverviewEscrow({ title: 'Overview Pagination 2' });
      await createOverviewEscrow({ title: 'Overview Pagination 3' });

      const pageOneResponse = await request(httpServer)
        .get('/escrows/overview?page=1&pageSize=2&sortBy=createdAt&sortOrder=desc')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const pageOneBody = pageOneResponse.body as EscrowOverviewResponse;
      expect(pageOneBody.page).toBe(1);
      expect(pageOneBody.pageSize).toBe(2);
      expect(pageOneBody.totalItems).toBeGreaterThanOrEqual(3);
      expect(pageOneBody.totalPages).toBe(
        Math.ceil(pageOneBody.totalItems / pageOneBody.pageSize),
      );
      expect(pageOneBody.data.length).toBeLessThanOrEqual(2);

      const outOfRangeResponse = await request(httpServer)
        .get('/escrows/overview?page=999&pageSize=2')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const outOfRangeBody = outOfRangeResponse.body as EscrowOverviewResponse;
      expect(outOfRangeBody.page).toBe(999);
      expect(outOfRangeBody.pageSize).toBe(2);
      expect(outOfRangeBody.data).toEqual([]);
    });

    it('should sort by created date and deadline', async () => {
      const idOld = await createOverviewEscrow({
        title: 'Overview Sort Old',
        expiresAt: '2026-06-10T10:00:00.000Z',
      });
      const idNew = await createOverviewEscrow({
        title: 'Overview Sort New',
        expiresAt: '2026-06-01T10:00:00.000Z',
      });

      await escrowRepository.update(idOld, {
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      await escrowRepository.update(idNew, {
        createdAt: new Date('2026-01-15T00:00:00.000Z'),
      });

      const createdSortResponse = await request(httpServer)
        .get('/escrows/overview?sortBy=createdAt&sortOrder=asc&pageSize=50')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const createdSortBody = createdSortResponse.body as EscrowOverviewResponse;
      const createdIds = createdSortBody.data.map((item) => item.escrowId);
      expect(createdIds.indexOf(idOld)).toBeLessThan(createdIds.indexOf(idNew));

      const deadlineSortResponse = await request(httpServer)
        .get('/escrows/overview?sortBy=deadline&sortOrder=asc&pageSize=50')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const deadlineSortBody =
        deadlineSortResponse.body as EscrowOverviewResponse;
      const deadlineIds = deadlineSortBody.data.map((item) => item.escrowId);
      expect(deadlineIds.indexOf(idNew)).toBeLessThan(
        deadlineIds.indexOf(idOld),
      );
    });
  });

  describe('GET /escrows/:id', () => {
    let escrowId: string;

    beforeAll(async () => {
      const response = await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Get Test Escrow',
          amount: 50,
          parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
        });
      escrowId = (response.body as EscrowResponse).id;
    });

    it('should return escrow details for creator', async () => {
      const response = await request(httpServer)
        .get(`/escrows/${escrowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as EscrowResponse;
      expect(body.id).toBe(escrowId);
      expect(body.title).toBe('Get Test Escrow');
    });

    it('should return escrow details for party', async () => {
      const response = await request(httpServer)
        .get(`/escrows/${escrowId}`)
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .expect(200);

      const body = response.body as EscrowResponse;
      expect(body.id).toBe(escrowId);
    });

    it('should return 404 for non-existent escrow', async () => {
      await request(httpServer)
        .get('/escrows/non-existent-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });
  });

  describe('PATCH /escrows/:id', () => {
    let escrowId: string;

    beforeEach(async () => {
      const response = await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Update Test Escrow',
          amount: 75,
          parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
        });
      escrowId = (response.body as EscrowResponse).id;
    });

    it('should update escrow by creator', async () => {
      const response = await request(httpServer)
        .patch(`/escrows/${escrowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ title: 'Updated Title' })
        .expect(200);

      const body = response.body as EscrowResponse;
      expect(body.title).toBe('Updated Title');
    });

    it('should return 403 when non-creator tries to update', async () => {
      await request(httpServer)
        .patch(`/escrows/${escrowId}`)
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .send({ title: 'Unauthorized Update' })
        .expect(403);
    });
  });

  describe('POST /escrows/:id/cancel', () => {
    let escrowId: string;

    beforeEach(async () => {
      const response = await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Cancel Test Escrow',
          amount: 25,
          parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
        });
      escrowId = (response.body as EscrowResponse).id;
    });

    it('should cancel escrow by creator', async () => {
      const response = await request(httpServer)
        .post(`/escrows/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Changed my mind' })
        .expect(201);

      const body = response.body as EscrowResponse;
      expect(body.status).toBe('cancelled');
    });

    it('should return 403 when non-creator tries to cancel pending escrow', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .send({ reason: 'Unauthorized cancel' })
        .expect(403);
    });

    it('should return 400 when trying to cancel already cancelled escrow', async () => {
      // First cancel
      await request(httpServer)
        .post(`/escrows/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});

      // Try to cancel again
      await request(httpServer)
        .post(`/escrows/${escrowId}/cancel`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });
  });
});
