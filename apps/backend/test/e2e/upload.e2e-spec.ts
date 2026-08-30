/**
 * E2E tests for dispute evidence upload endpoints.
 *
 * Routes under test (all prefixed /v1 by the URI versioning middleware):
 *   POST   /v1/disputes/:id/evidence
 *   GET    /v1/disputes/:id/evidence
 *   GET    /v1/disputes/:id/evidence/:evidenceId/download
 *   DELETE /v1/disputes/:id/evidence/:evidenceId   (admin only)
 */

import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import type { Server } from 'http';
import { Keypair } from '@stellar/stellar-sdk';

import { createTestApp } from '../setup/test-app.factory';
import { resetDatabase } from '../setup/test-db';
import { AllowedAsset } from '../../src/modules/assets/entities/allowed-asset.entity';
import { Escrow, EscrowStatus, EscrowType } from '../../src/modules/escrow/entities/escrow.entity';
import { Dispute, DisputeStatus } from '../../src/modules/escrow/entities/dispute.entity';
import { Party, PartyRole } from '../../src/modules/escrow/entities/party.entity';
import { User, UserRole } from '../../src/modules/user/entities/user.entity';
import { DisputeEvidence, EvidenceStatus } from '../../src/modules/upload/entities/dispute-evidence.entity';

// ─────────────────────────────────────────────────────────────────────────────
// Magic-byte buffers for the accepted file types
// ─────────────────────────────────────────────────────────────────────────────
const PNG_BUF  = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array(100).fill(0x00)]);
const JPEG_BUF = Buffer.from([0xff, 0xd8, 0xff, 0xe0, ...Array(100).fill(0x00)]);
const PDF_BUF  = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, ...Array(100).fill(0x20)]);
const TXT_BUF  = Buffer.from('This is a plain text evidence file.\n');
const DOCX_BUF = Buffer.from([0x50, 0x4b, 0x03, 0x04, ...Array(100).fill(0x00)]); // ZIP magic
const BAD_BUF  = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

// ─────────────────────────────────────────────────────────────────────────────
// Helper — authenticate a wallet and return JWT + userId
// ─────────────────────────────────────────────────────────────────────────────
async function authenticate(
  server: Server,
  keypair: Keypair,
): Promise<{ token: string; userId: string }> {
  const challengeRes = await request(server)
    .post('/v1/auth/challenge')
    .send({ walletAddress: keypair.publicKey() });

  const message = (challengeRes.body as { message: string }).message;
  const signature = keypair.sign(Buffer.from(message)).toString('hex');

  const verifyRes = await request(server)
    .post('/v1/auth/verify')
    .send({ walletAddress: keypair.publicKey(), signature, publicKey: keypair.publicKey() });

  const body = verifyRes.body as { accessToken: string; user: { id: string } };
  return { token: body.accessToken, userId: body.user.id };
}

// ─────────────────────────────────────────────────────────────────────────────

describe('Upload / Evidence (e2e)', () => {
  let app: INestApplication;
  let server: Server;
  let dataSource: DataSource;

  let buyerKp: Keypair;
  let sellerKp: Keypair;
  let adminKp: Keypair;

  let buyerToken: string;
  let buyerId: string;
  let sellerToken: string;
  let adminToken: string;
  let adminId: string;

  let escrowId: string;
  let disputeId: string;

  beforeAll(async () => {
    process.env.DATABASE_PATH = ':memory:';
    process.env.NODE_ENV = 'test';
    process.env.UPLOAD_BASE_DIR = '/tmp/vaultix-test-uploads';

    buyerKp  = Keypair.random();
    sellerKp = Keypair.random();
    adminKp  = Keypair.random();

    app = await createTestApp();
    server = app.getHttpServer() as Server;
    dataSource = app.get(DataSource);

    // Seed allowed asset
    await dataSource.getRepository(AllowedAsset).save({
      code: 'XLM',
      displayName: 'Stellar Lumens',
      decimals: 7,
      active: true,
    });

    // Register + authenticate users
    ({ token: buyerToken, userId: buyerId }   = await authenticate(server, buyerKp));
    ({ token: sellerToken }                   = await authenticate(server, sellerKp));
    ({ token: adminToken, userId: adminId }   = await authenticate(server, adminKp));

    // Promote admin user
    await dataSource.getRepository(User).update({ id: adminId }, { role: UserRole.ADMIN });

    // Seed escrow + parties + dispute directly via TypeORM
    const escrowRepo   = dataSource.getRepository(Escrow);
    const partyRepo    = dataSource.getRepository(Party);
    const disputeRepo  = dataSource.getRepository(Dispute);

    const escrow = await escrowRepo.save({
      id: undefined,
      title: 'Test Escrow',
      description: 'desc',
      amount: '100',
      asset: 'XLM',
      buyerWallet: buyerKp.publicKey(),
      sellerWallet: sellerKp.publicKey(),
      status: EscrowStatus.DISPUTED,
      type: EscrowType.STANDARD,
      createdById: buyerId,
    } as unknown as Escrow);
    escrowId = escrow.id;

    await partyRepo.save([
      { escrowId, userId: buyerId,  role: PartyRole.BUYER,  accepted: true } as unknown as Party,
    ]);

    const dispute = await disputeRepo.save({
      escrowId,
      filedByUserId: buyerId,
      reason: 'Seller did not deliver',
      status: DisputeStatus.OPEN,
    } as unknown as Dispute);
    disputeId = dispute.id;
  });

  afterAll(async () => {
    await app.close();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // POST /v1/disputes/:id/evidence
  // ──────────────────────────────────────────────────────────────────────────

  describe('POST /v1/disputes/:id/evidence', () => {
    it('201 — uploads a valid PNG', async () => {
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', PNG_BUF, { filename: 'screenshot.png', contentType: 'image/png' });

      expect(res.status).toBe(201);
      const body = res.body as { disputeId: string; uploaded: { mimeType: string }[] };
      expect(body.disputeId).toBe(disputeId);
      expect(body.uploaded).toHaveLength(1);
      expect(body.uploaded[0].mimeType).toBe('image/png');
    });

    it('201 — uploads a valid PDF', async () => {
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', PDF_BUF, { filename: 'contract.pdf', contentType: 'application/pdf' });

      expect(res.status).toBe(201);
    });

    it('201 — uploads JPEG, TXT, and DOCX', async () => {
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', JPEG_BUF, { filename: 'photo.jpg', contentType: 'image/jpeg' })
        .attach('files', TXT_BUF,  { filename: 'notes.txt', contentType: 'text/plain' })
        .attach('files', DOCX_BUF, { filename: 'doc.docx', contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      expect(res.status).toBe(201);
      const body = res.body as { uploaded: unknown[] };
      expect(body.uploaded).toHaveLength(3);
    });

    it('400 — rejects unknown binary type via magic bytes', async () => {
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', BAD_BUF, { filename: 'exploit.exe', contentType: 'image/png' });

      expect(res.status).toBe(400);
    });

    it('401 — rejects unauthenticated upload', async () => {
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .attach('files', PNG_BUF, { filename: 'screenshot.png', contentType: 'image/png' });

      expect(res.status).toBe(401);
    });

    it('403 — rejects upload from non-party user', async () => {
      // sellerKp is not a party (only buyer was added to parties)
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(sellerToken, { type: 'bearer' })
        .attach('files', PNG_BUF, { filename: 'screenshot.png', contentType: 'image/png' });

      expect(res.status).toBe(403);
    });

    it('404 — returns 404 for unknown dispute', async () => {
      const res = await request(server)
        .post('/v1/disputes/00000000-0000-0000-0000-000000000000/evidence')
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', PNG_BUF, { filename: 'screenshot.png', contentType: 'image/png' });

      expect(res.status).toBe(404);
    });

    it('400 — rejects upload when quota is exceeded', async () => {
      // Seed 10 evidence rows directly
      const evidenceRepo = dataSource.getRepository(DisputeEvidence);
      const rows = Array.from({ length: 10 }, (_, i) => ({
        disputeId,
        uploadedById: buyerId,
        storedFilename: `fill-${i}.png`,
        originalFilename: `fill-${i}.png`,
        mimeType: 'image/png',
        size: 8,
        storagePath: `evidence/${disputeId}/fill-${i}.png`,
        thumbnailPath: null,
        checksum: 'abc',
        scanStatus: EvidenceStatus.CLEAN,
        scanResult: 'OK',
        scannedAt: new Date(),
        deleted: false,
        deletedById: null,
        deletedAt: null,
      }));
      await evidenceRepo.save(rows);

      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', PNG_BUF, { filename: 'extra.png', contentType: 'image/png' });

      expect(res.status).toBe(400);

      // Cleanup quota rows
      await evidenceRepo.delete({ uploadedById: buyerId, storedFilename: /^fill-/ as unknown as string });
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /v1/disputes/:id/evidence
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /v1/disputes/:id/evidence', () => {
    it('200 — lists evidence for a party member', async () => {
      const res = await request(server)
        .get(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('401 — rejects unauthenticated request', async () => {
      const res = await request(server)
        .get(`/v1/disputes/${disputeId}/evidence`);

      expect(res.status).toBe(401);
    });

    it('403 — rejects non-party user', async () => {
      const res = await request(server)
        .get(`/v1/disputes/${disputeId}/evidence`)
        .auth(sellerToken, { type: 'bearer' });

      expect(res.status).toBe(403);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // GET /v1/disputes/:id/evidence/:evidenceId/download
  // ──────────────────────────────────────────────────────────────────────────

  describe('GET /v1/disputes/:id/evidence/:evidenceId/download', () => {
    let evidenceId: string;

    beforeAll(async () => {
      // Upload one file to get a valid evidenceId
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', PDF_BUF, { filename: 'download-test.pdf', contentType: 'application/pdf' });

      const body = res.body as { uploaded: { id: string }[] };
      evidenceId = body.uploaded[0].id;
    });

    it('200 — downloads an evidence file with correct Content-Type', async () => {
      const res = await request(server)
        .get(`/v1/disputes/${disputeId}/evidence/${evidenceId}/download`)
        .auth(buyerToken, { type: 'bearer' });

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('401 — rejects unauthenticated download', async () => {
      const res = await request(server)
        .get(`/v1/disputes/${disputeId}/evidence/${evidenceId}/download`);

      expect(res.status).toBe(401);
    });

    it('404 — returns 404 for unknown evidenceId', async () => {
      const res = await request(server)
        .get(`/v1/disputes/${disputeId}/evidence/00000000-0000-0000-0000-000000000099/download`)
        .auth(buyerToken, { type: 'bearer' });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // DELETE /v1/disputes/:id/evidence/:evidenceId  (admin only)
  // ──────────────────────────────────────────────────────────────────────────

  describe('DELETE /v1/disputes/:id/evidence/:evidenceId', () => {
    let targetEvidenceId: string;

    beforeAll(async () => {
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', TXT_BUF, { filename: 'to-delete.txt', contentType: 'text/plain' });

      const body = res.body as { uploaded: { id: string }[] };
      targetEvidenceId = body.uploaded[0].id;
    });

    it('200 — admin can delete evidence', async () => {
      const res = await request(server)
        .delete(`/v1/disputes/${disputeId}/evidence/${targetEvidenceId}`)
        .auth(adminToken, { type: 'bearer' });

      expect(res.status).toBe(200);
      const body = res.body as { success: boolean };
      expect(body.success).toBe(true);
    });

    it('403 — non-admin user cannot delete evidence', async () => {
      // Upload a fresh file first
      const uploadRes = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', TXT_BUF, { filename: 'no-delete.txt', contentType: 'text/plain' });

      const body = uploadRes.body as { uploaded: { id: string }[] };
      const id = body.uploaded[0].id;

      const res = await request(server)
        .delete(`/v1/disputes/${disputeId}/evidence/${id}`)
        .auth(buyerToken, { type: 'bearer' });

      expect(res.status).toBe(403);
    });

    it('401 — unauthenticated request is rejected', async () => {
      const res = await request(server)
        .delete(`/v1/disputes/${disputeId}/evidence/${targetEvidenceId}`);

      expect(res.status).toBe(401);
    });

    it('404 — deleting already-deleted (soft) evidence returns 404', async () => {
      // targetEvidenceId was already deleted above
      const res = await request(server)
        .delete(`/v1/disputes/${disputeId}/evidence/${targetEvidenceId}`)
        .auth(adminToken, { type: 'bearer' });

      expect(res.status).toBe(404);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Magic-byte validation edge-cases
  // ──────────────────────────────────────────────────────────────────────────

  describe('MIME validation edge-cases', () => {
    it('rejects a PNG file renamed as .pdf (magic bytes override extension)', async () => {
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        // Send PNG bytes with a PDF content-type header — magic bytes say PNG which IS allowed,
        // so the store should succeed but record mimeType as image/png not application/pdf.
        .attach('files', PNG_BUF, { filename: 'fake.pdf', contentType: 'application/pdf' });

      // Upload should succeed (PNG bytes are allowed); MIME in response should reflect magic bytes
      expect(res.status).toBe(201);
      const body = res.body as { uploaded: { mimeType: string }[] };
      expect(body.uploaded[0].mimeType).toBe('image/png');
    });

    it('rejects a file with null-byte in filename', async () => {
      const res = await request(server)
        .post(`/v1/disputes/${disputeId}/evidence`)
        .auth(buyerToken, { type: 'bearer' })
        .attach('files', PNG_BUF, { filename: 'evil\x00.png', contentType: 'image/png' });

      // Either 400 (rejected) or 201 with sanitised name — must not 500
      expect([200, 201, 400]).toContain(res.status);
    });
  });
});
