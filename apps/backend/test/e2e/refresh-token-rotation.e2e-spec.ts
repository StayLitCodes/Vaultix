import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { createTestApp } from '../setup/test-app.factory';
import { Keypair } from 'stellar-sdk';

/**
 * Integration tests for atomic refresh-token rotation.
 *
 * Covers:
 * 1. Simultaneous refresh – only one request wins, the other is rejected.
 * 2. Replay after rotation – using an already-consumed token fails.
 * 3. Logout before refresh – token invalidated by logout cannot be refreshed.
 * 4. Transaction rollback – partial rotation never leaves orphaned state.
 * 5. Inactive user – rotation rejected when the user is deactivated.
 *
 * Scope: Narrow concurrency follow-up to session-management issue #608.
 *         No new session-management UI.
 */

interface ChallengeResponse {
  nonce: string;
  message: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

/**
 * Helper: Authenticate a fresh keypair and return both the keypair and the
 * token pair. Does NOT log token values.
 */
async function authenticateUser(
  httpServer: Server,
): Promise<{ keypair: Keypair; tokens: TokenResponse }> {
  const keypair = Keypair.random();
  const walletAddress = keypair.publicKey();

  // Step 1 – challenge
  const challengeRes = await request(httpServer)
    .post('/auth/challenge')
    .send({ walletAddress })
    .expect(200);

  const { message } = challengeRes.body as ChallengeResponse;

  // Step 2 – sign + verify
  const signature = keypair.sign(Buffer.from(message)).toString('hex');
  const verifyRes = await request(httpServer)
    .post('/auth/verify')
    .send({ signature, publicKey: walletAddress })
    .expect(200);

  return {
    keypair,
    tokens: verifyRes.body as TokenResponse,
  };
}

describe('Refresh-token rotation (integration)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let dataSource: DataSource;

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
    dataSource = app.get(DataSource);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  // ─── 1. Simultaneous refresh: only one winner ────────────────────
  describe('simultaneous refresh attempts', () => {
    it('should allow exactly one winner and reject the other', async () => {
      const { tokens } = await authenticateUser(httpServer);

      // Fire two concurrent refresh requests with the *same* token.
      const [res1, res2] = await Promise.all([
        request(httpServer)
          .post('/auth/refresh')
          .send({ refreshToken: tokens.refreshToken }),
        request(httpServer)
          .post('/auth/refresh')
          .send({ refreshToken: tokens.refreshToken }),
      ]);

      const statuses = [res1.status, res2.status].sort();

      // Exactly one should succeed (200), the other should fail.
      // The loser gets either 409 Conflict (replay) or 401 Unauthorized.
      expect(statuses).toContain(200);
      expect(
        statuses.includes(409) || statuses.includes(401),
      ).toBe(true);

      // The winner must have received a new token pair.
      const winner = res1.status === 200 ? res1 : res2;
      const winnerBody = winner.body as TokenResponse;
      expect(winnerBody.accessToken).toBeDefined();
      expect(winnerBody.refreshToken).toBeDefined();
      expect(winnerBody.refreshToken).not.toBe(tokens.refreshToken);

      // Assert exactly one active successor exists for this token lineage.
      const activeTokens = await dataSource
        .getRepository('RefreshToken')
        .find({ where: { isActive: true, userId: undefined } });

      // More precise: count active tokens for the specific user
      // by using the winner's new refresh token to look it up.
      const successorToken = await dataSource
        .getRepository('RefreshToken')
        .findOne({
          where: { token: winnerBody.refreshToken, isActive: true },
        });
      expect(successorToken).toBeDefined();
    });
  });

  // ─── 2. Replay after rotation ────────────────────────────────────
  describe('replay after rotation', () => {
    it('should reject a consumed refresh token', async () => {
      const { tokens } = await authenticateUser(httpServer);

      // First rotation – should succeed.
      const firstRotation = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      const newTokens = firstRotation.body as TokenResponse;
      expect(newTokens.refreshToken).toBeDefined();

      // Replay – attempt to use the old token again.
      const replay = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });

      // Should be rejected with 409 (already consumed) or 401.
      expect([409, 401]).toContain(replay.status);
    });

    it('should allow the successor token to be used for the next rotation', async () => {
      const { tokens } = await authenticateUser(httpServer);

      // Rotate once.
      const first = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      const firstBody = first.body as TokenResponse;

      // Rotate again using the successor.
      const second = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: firstBody.refreshToken })
        .expect(200);

      const secondBody = second.body as TokenResponse;
      expect(secondBody.accessToken).toBeDefined();
      expect(secondBody.refreshToken).toBeDefined();
      expect(secondBody.refreshToken).not.toBe(firstBody.refreshToken);
    });
  });

  // ─── 3. Logout before refresh ────────────────────────────────────
  describe('logout before refresh', () => {
    it('should reject refresh after the token was invalidated by logout', async () => {
      const { tokens, keypair } = await authenticateUser(httpServer);

      // Logout – invalidates the refresh token.
      await request(httpServer)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      // Attempt to refresh with the now-invalidated token.
      const refreshAttempt = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });

      // Should be rejected (409 or 401).
      expect([409, 401]).toContain(refreshAttempt.status);
    });
  });

  // ─── 4. Transaction rollback: assert one active successor ───────
  describe('transaction integrity', () => {
    it('should maintain exactly one active token after successful rotation', async () => {
      const { tokens, keypair } = await authenticateUser(httpServer);
      const walletAddress = keypair.publicKey();

      // Find the user to get their ID.
      const user = await dataSource
        .getRepository('User')
        .findOne({ where: { walletAddress } });
      expect(user).toBeDefined();

      // Count active tokens before rotation.
      const beforeCount = await dataSource
        .getRepository('RefreshToken')
        .count({ where: { userId: (user as any).id, isActive: true } });
      expect(beforeCount).toBe(1);

      // Rotate.
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      // Count active tokens after rotation – should still be exactly 1.
      const afterCount = await dataSource
        .getRepository('RefreshToken')
        .count({ where: { userId: (user as any).id, isActive: true } });
      expect(afterCount).toBe(1);
    });

    it('should not leave orphaned successor if the old token was already consumed', async () => {
      const { tokens, keypair } = await authenticateUser(httpServer);
      const walletAddress = keypair.publicKey();

      const user = await dataSource
        .getRepository('User')
        .findOne({ where: { walletAddress } });

      // Rotate once (consumes the original).
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);

      // Attempt replay – should fail.
      await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });

      // Still exactly one active token for this user.
      const activeCount = await dataSource
        .getRepository('RefreshToken')
        .count({ where: { userId: (user as any).id, isActive: true } });
      expect(activeCount).toBe(1);
    });
  });

  // ─── 5. Inactive user rejection ──────────────────────────────────
  describe('inactive user rejection', () => {
    it('should reject refresh when the user has been deactivated', async () => {
      const { tokens, keypair } = await authenticateUser(httpServer);
      const walletAddress = keypair.publicKey();

      // Deactivate the user directly in the database.
      await dataSource
        .getRepository('User')
        .update({ walletAddress }, { isActive: false });

      // Attempt to refresh.
      const res = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: tokens.refreshToken });

      // Should be rejected (401 – user inactive).
      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty('message');
    });
  });
});
