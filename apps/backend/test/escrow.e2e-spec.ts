import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from '../src/app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Escrow, EscrowStatus } from '../src/modules/escrow/entities/escrow.entity';
import { PartyRole } from '../src/modules/escrow/entities/party.entity';

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

  let arbitratorKeypair: MockKeypair;
  let arbitratorWalletAddress: string;
  let arbitratorAccessToken: string;
  let arbitratorUserId: string;

  let escrowRepository: Repository<Escrow>;

  beforeAll(async () => {
    // Use an isolated in-memory SQLite database for every test run
    process.env.DATABASE_PATH = ':memory:';
    process.env.NODE_ENV = 'test';

    testKeypair = createMockKeypair();
    testWalletAddress = testKeypair.publicKey();

    secondKeypair = createMockKeypair();
    secondWalletAddress = secondKeypair.publicKey();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

    // Authenticate arbitrator user
    arbitratorKeypair = createMockKeypair();
    arbitratorWalletAddress = arbitratorKeypair.publicKey();

    const challenge3 = await request(httpServer)
      .post('/auth/challenge')
      .send({ walletAddress: arbitratorWalletAddress });

    const message3 = (challenge3.body as { message: string }).message;
    const signature3 = arbitratorKeypair.sign(message3).toString('hex');

    const verify3 = await request(httpServer).post('/auth/verify').send({
      walletAddress: arbitratorWalletAddress,
      signature: signature3,
      publicKey: arbitratorWalletAddress,
    });

    arbitratorAccessToken = (verify3.body as { accessToken: string }).accessToken;

    const me3 = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${arbitratorAccessToken}`);
    arbitratorUserId = (me3.body as { id: string }).id;

    // Grab the Escrow repository for direct DB manipulation in dispute tests
    escrowRepository = app.get<Repository<Escrow>>(getRepositoryToken(Escrow));
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

  // ---------------------------------------------------------------------------
  // Dispute management
  // ---------------------------------------------------------------------------

  interface DisputeResponse {
    id: string;
    escrowId: string;
    reason: string;
    status: string;
    filedByUserId: string;
    evidence: string[] | null;
    outcome: string | null;
    resolutionNotes: string | null;
    sellerPercent: string | null;
    buyerPercent: string | null;
    resolvedByUserId: string | null;
    resolvedAt: string | null;
  }

  /** Create an escrow with buyer + seller + arbitrator and force it to ACTIVE. */
  const createActiveEscrow = async (): Promise<string> => {
    const res = await request(httpServer)
      .post('/escrows')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        title: 'Dispute Test Escrow',
        amount: 100,
        parties: [
          { userId: secondUserId, role: PartyRole.SELLER },
          { userId: arbitratorUserId, role: PartyRole.ARBITRATOR },
        ],
      });
    const id = (res.body as EscrowResponse).id;
    await escrowRepository.update(id, { status: EscrowStatus.ACTIVE });
    return id;
  };

  /** Create an ACTIVE escrow and immediately file a dispute on it (buyer). */
  const createDisputedEscrow = async (): Promise<string> => {
    const id = await createActiveEscrow();
    await request(httpServer)
      .post(`/escrows/${id}/dispute`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ reason: 'Pre-filed dispute for resolution tests' });
    return id;
  };

  describe('POST /escrows/:id/dispute', () => {
    let escrowId: string;

    beforeEach(async () => {
      escrowId = await createActiveEscrow();
    });

    it('should allow a buyer to file a dispute', async () => {
      const res = await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Goods not delivered as described' })
        .expect(201);

      const body = res.body as DisputeResponse;
      expect(body).toHaveProperty('id');
      expect(body.escrowId).toBe(escrowId);
      expect(body.reason).toBe('Goods not delivered as described');
      expect(body.status).toBe('open');
      expect(body.filedByUserId).toBe(userId);
      expect(body.outcome).toBeNull();
    });

    it('should allow a seller to file a dispute with evidence', async () => {
      const evidence = ['https://example.com/screenshot.png', 'ipfs://QmAbc123'];
      const res = await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .send({ reason: 'Payment terms violated', evidence })
        .expect(201);

      const body = res.body as DisputeResponse;
      expect(body.filedByUserId).toBe(secondUserId);
      expect(body.evidence).toEqual(evidence);
    });

    it('should transition escrow status to disputed', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Status transition check' })
        .expect(201);

      const escrowRes = await request(httpServer)
        .get(`/escrows/${escrowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect((escrowRes.body as EscrowResponse).status).toBe('disputed');
    });

    it('should return 400 when escrow is not active (pending)', async () => {
      const pendingRes = await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Pending Escrow',
          amount: 50,
          parties: [
            { userId: secondUserId, role: PartyRole.SELLER },
            { userId: arbitratorUserId, role: PartyRole.ARBITRATOR },
          ],
        });
      const pendingId = (pendingRes.body as EscrowResponse).id;

      await request(httpServer)
        .post(`/escrows/${pendingId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Should be rejected' })
        .expect(400);
    });

    it('should return 403 when an arbitrator tries to file a dispute', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({ reason: 'Arbitrators mediate, not file' })
        .expect(403);
    });

    it('should return 409 when a duplicate dispute is filed', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'First dispute' })
        .expect(201);

      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .send({ reason: 'Second dispute attempt' })
        .expect(409);
    });

    it('should return 400 for missing reason', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({})
        .expect(400);
    });

    it('should return 401 without an auth token', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .send({ reason: 'No token' })
        .expect(401);
    });
  });

  describe('GET /escrows/:id/dispute', () => {
    let escrowId: string;

    beforeEach(async () => {
      escrowId = await createActiveEscrow();
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Disputed delivery', evidence: ['https://proof.example.com'] });
    });

    it('should return dispute details for the filing party (buyer)', async () => {
      const res = await request(httpServer)
        .get(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = res.body as DisputeResponse;
      expect(body).toHaveProperty('id');
      expect(body.escrowId).toBe(escrowId);
      expect(body.reason).toBe('Disputed delivery');
      expect(body.status).toBe('open');
      expect(body.evidence).toEqual(['https://proof.example.com']);
      expect(body.outcome).toBeNull();
      expect(body.resolvedAt).toBeNull();
    });

    it('should return dispute details for the seller', async () => {
      const res = await request(httpServer)
        .get(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .expect(200);

      expect((res.body as DisputeResponse).reason).toBe('Disputed delivery');
    });

    it('should return dispute details for the arbitrator', async () => {
      const res = await request(httpServer)
        .get(`/escrows/${escrowId}/dispute`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .expect(200);

      expect((res.body as DisputeResponse).reason).toBe('Disputed delivery');
    });

    it('should return 404 when no dispute exists for the escrow', async () => {
      // Create a fresh active escrow with no dispute
      const freshId = await createActiveEscrow();

      await request(httpServer)
        .get(`/escrows/${freshId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 403 for a user who is not a party to the escrow', async () => {
      // Create a separate escrow that excludes the arbitrator
      const outsiderRes = await request(httpServer)
        .post('/escrows')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          title: 'Outsider Test Escrow',
          amount: 50,
          parties: [{ userId: secondUserId, role: PartyRole.SELLER }],
        });
      const outsiderId = (outsiderRes.body as EscrowResponse).id;
      await escrowRepository.update(outsiderId, { status: EscrowStatus.ACTIVE });
      await request(httpServer)
        .post(`/escrows/${outsiderId}/dispute`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ reason: 'Outsider test' });

      // arbitratorUserId is NOT a party here — should get 403
      await request(httpServer)
        .get(`/escrows/${outsiderId}/dispute`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .expect(403);
    });
  });

  describe('POST /escrows/:id/dispute/resolve', () => {
    let escrowId: string;

    beforeEach(async () => {
      escrowId = await createDisputedEscrow();
    });

    it('should resolve a dispute with outcome released_to_seller', async () => {
      const res = await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({
          outcome: 'released_to_seller',
          resolutionNotes: 'Seller provided valid proof of delivery',
        })
        .expect(201);

      const body = res.body as DisputeResponse;
      expect(body.status).toBe('resolved');
      expect(body.outcome).toBe('released_to_seller');
      expect(body.resolutionNotes).toBe('Seller provided valid proof of delivery');
      expect(body.resolvedByUserId).toBe(arbitratorUserId);
      expect(body.resolvedAt).not.toBeNull();
    });

    it('should resolve a dispute with outcome refunded_to_buyer', async () => {
      const res = await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({
          outcome: 'refunded_to_buyer',
          resolutionNotes: 'Seller failed to deliver',
        })
        .expect(201);

      const body = res.body as DisputeResponse;
      expect(body.status).toBe('resolved');
      expect(body.outcome).toBe('refunded_to_buyer');
    });

    it('should resolve a dispute with a split outcome', async () => {
      const res = await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({
          outcome: 'split',
          resolutionNotes: 'Partial delivery accepted',
          sellerPercent: 60,
          buyerPercent: 40,
        })
        .expect(201);

      const body = res.body as DisputeResponse;
      expect(body.status).toBe('resolved');
      expect(body.outcome).toBe('split');
      expect(Number(body.sellerPercent)).toBe(60);
      expect(Number(body.buyerPercent)).toBe(40);
    });

    it('should transition escrow to completed for released_to_seller', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({ outcome: 'released_to_seller', resolutionNotes: 'Seller wins' });

      const escrowRes = await request(httpServer)
        .get(`/escrows/${escrowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect((escrowRes.body as EscrowResponse).status).toBe('completed');
    });

    it('should transition escrow to cancelled for refunded_to_buyer', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({ outcome: 'refunded_to_buyer', resolutionNotes: 'Buyer wins' });

      const escrowRes = await request(httpServer)
        .get(`/escrows/${escrowId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect((escrowRes.body as EscrowResponse).status).toBe('cancelled');
    });

    it('should return 403 when a buyer tries to resolve', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ outcome: 'released_to_seller', resolutionNotes: 'Buyer self-resolving' })
        .expect(403);
    });

    it('should return 403 when a seller tries to resolve', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${secondAccessToken}`)
        .send({ outcome: 'refunded_to_buyer', resolutionNotes: 'Seller self-resolving' })
        .expect(403);
    });

    it('should return 422 when split outcome is missing percentages', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({ outcome: 'split', resolutionNotes: 'Forgot percentages' })
        .expect(422);
    });

    it('should return 422 when split percentages do not sum to 100', async () => {
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({
          outcome: 'split',
          resolutionNotes: 'Bad math',
          sellerPercent: 60,
          buyerPercent: 30,
        })
        .expect(422);
    });

    it('should return 400 when trying to resolve an already-resolved dispute', async () => {
      // First resolution succeeds
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({ outcome: 'released_to_seller', resolutionNotes: 'First resolution' })
        .expect(201);

      // Second attempt: escrow is no longer DISPUTED → 400
      await request(httpServer)
        .post(`/escrows/${escrowId}/dispute/resolve`)
        .set('Authorization', `Bearer ${arbitratorAccessToken}`)
        .send({ outcome: 'refunded_to_buyer', resolutionNotes: 'Second attempt' })
        .expect(400);
    });
  });
});
