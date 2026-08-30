import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { DataSource } from 'typeorm';
import { Keypair } from 'stellar-sdk';
import { createTestApp } from '../setup/test-app.factory';
import { AllowedAsset } from '../../src/modules/assets/entities/allowed-asset.entity';
import { Dispute, DisputeStatus } from '../../src/modules/escrow/entities/dispute.entity';
import { Escrow, EscrowStatus } from '../../src/modules/escrow/entities/escrow.entity';

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(100)]);
const PDF_HEADER = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, ...Buffer.alloc(50)]);
const BAD_FILE = Buffer.from([0x00, 0x01, 0x02, 0x03]);

async function authenticate(
  httpServer: Server,
  keypair: Keypair,
): Promise<{ token: string; userId: string }> {
  const challengeRes = await request(httpServer)
    .post('/auth/challenge')
    .send({ walletAddress: keypair.publicKey() });

  const message = (challengeRes.body as { message: string }).message;
  const signature = keypair.sign(Buffer.from(message)).toString('hex');

  const verifyRes = await request(httpServer).post('/auth/verify').send({
    walletAddress: keypair.publicKey(),
    signature,
    publicKey: keypair.publicKey(),
  });

  const token = (verifyRes.body as { accessToken: string }).accessToken;

  const meRes = await request(httpServer)
    .get('/auth/me')
    .set('Authorization', `Bearer ${token}`);

  return { token, userId: (meRes.body as { id: string }).id };
}

describe('Upload (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;

  let buyerToken: string;
  let buyerUserId: string;

  let sellerToken: string;

  let disputeId: string;

  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.NODE_ENV = 'test';

    app = await createTestApp(undefined, (a) => {
      a.useGlobalPipes(new ValidationPipe({ transform: true }));
    });
    httpServer = app.getHttpServer() as Server;
    dataSource = app.get(DataSource);

    await dataSource.getRepository(AllowedAsset).save({
      code: 'XLM',
      displayName: 'Stellar Lumens',
      decimals: 7,
      active: true,
    });

    const buyer = Keypair.random();
    const seller = Keypair.random();

    ({ token: buyerToken, userId: buyerUserId } = await authenticate(httpServer, buyer));
    ({ token: sellerToken } = await authenticate(httpServer, seller));

    // Create an escrow in DISPUTED state with a dispute record directly via DB
    const escrowRepo = dataSource.getRepository(Escrow);
    const disputeRepo = dataSource.getRepository(Dispute);

    const escrow = await escrowRepo.save(
      escrowRepo.create({
        title: 'Test Escrow',
        description: 'E2E upload test',
        amount: 100,
        assetCode: 'XLM',
        status: EscrowStatus.DISPUTED,
        creatorId: buyerUserId,
      }),
    );

    const dispute = await disputeRepo.save(
      disputeRepo.create({
        escrowId: escrow.id,
        filedByUserId: buyerUserId,
        reason: 'Test dispute for upload e2e',
        status: DisputeStatus.OPEN,
      }),
    );

    disputeId = dispute.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /disputes/:id/evidence', () => {
    it('uploads a valid PNG and returns evidence metadata', async () => {
      const res = await request(httpServer)
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      const body = res.body as {
        id: string;
        disputeId: string;
        mimeType: string;
        originalName: string;
      };
      expect(body.disputeId).toBe(disputeId);
      expect(body.mimeType).toBe('image/png');
      expect(body.originalName).toBe('photo.png');
    });

    it('uploads a valid PDF', async () => {
      const res = await request(httpServer)
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .attach('file', PDF_HEADER, { filename: 'contract.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
      expect((res.body as { mimeType: string }).mimeType).toBe('application/pdf');
    });

    it('rejects unsupported file type (EXE-like binary)', async () => {
      const res = await request(httpServer)
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .attach('file', BAD_FILE, { filename: 'bad.exe', contentType: 'application/octet-stream' });

      expect(res.status).toBe(422);
    });

    it('returns 404 for non-existent dispute', async () => {
      const res = await request(httpServer)
        .post('/disputes/00000000-0000-0000-0000-000000000000/evidence')
        .set('Authorization', `Bearer ${buyerToken}`)
        .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

      expect(res.status).toBe(404);
    });

    it('returns 403 without auth token', async () => {
      const res = await request(httpServer)
        .post(`/disputes/${disputeId}/evidence`)
        .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

      expect(res.status).toBe(401);
    });

    it('returns 403 for user without dispute access', async () => {
      const outsider = Keypair.random();
      const { token: outsiderToken } = await authenticate(httpServer, outsider);

      const res = await request(httpServer)
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${outsiderToken}`)
        .attach('file', PNG_HEADER, { filename: 'photo.png', contentType: 'image/png' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /disputes/:id/evidence', () => {
    it('returns list of evidence for a dispute', async () => {
      const res = await request(httpServer)
        .get(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      const body = res.body as { data: unknown[]; total: number };
      expect(typeof body.total).toBe('number');
      expect(Array.isArray(body.data)).toBe(true);
    });

    it('returns 404 for unknown dispute', async () => {
      const res = await request(httpServer)
        .get('/disputes/00000000-0000-0000-0000-000000000000/evidence')
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('GET /disputes/:id/evidence/:evidenceId/download', () => {
    it('streams the evidence file', async () => {
      // Upload first
      const uploadRes = await request(httpServer)
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .attach('file', PNG_HEADER, { filename: 'download_test.png', contentType: 'image/png' });

      const evidenceId = (uploadRes.body as { id: string }).id;

      const res = await request(httpServer)
        .get(`/disputes/${disputeId}/evidence/${evidenceId}/download`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/png/);
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });

    it('returns 404 for unknown evidence', async () => {
      const res = await request(httpServer)
        .get(
          `/disputes/${disputeId}/evidence/00000000-0000-0000-0000-000000000000/download`,
        )
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /disputes/:id/evidence/:evidenceId', () => {
    it('returns 403 for non-admin user', async () => {
      // Upload a file first
      const uploadRes = await request(httpServer)
        .post(`/disputes/${disputeId}/evidence`)
        .set('Authorization', `Bearer ${buyerToken}`)
        .attach('file', PNG_HEADER, { filename: 'to_delete.png', contentType: 'image/png' });

      const evidenceId = (uploadRes.body as { id: string }).id;

      const res = await request(httpServer)
        .delete(`/disputes/${disputeId}/evidence/${evidenceId}`)
        .set('Authorization', `Bearer ${buyerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
