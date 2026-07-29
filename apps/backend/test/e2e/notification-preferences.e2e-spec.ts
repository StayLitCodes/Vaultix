import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { createTestApp } from '../setup/test-app.factory';
import { Keypair } from 'stellar-sdk';

interface ChallengeResponse {
  nonce: string;
  message: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface PreferenceResponse {
  id: string;
  userId: string;
  channel: 'email' | 'webhook';
  enabled: boolean;
  eventTypes: string[];
}

describe('Notification Preferences (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let testKeypair: Keypair;
  let testWalletAddress: string;
  let accessToken: string;

  async function authenticate(): Promise<string> {
    const challengeResponse = await request(httpServer)
      .post('/auth/challenge')
      .send({ walletAddress: testWalletAddress })
      .expect(200);

    const message = (challengeResponse.body as ChallengeResponse).message;
    const signature = testKeypair.sign(Buffer.from(message)).toString('hex');

    const verifyResponse = await request(httpServer)
      .post('/auth/verify')
      .send({ signature, publicKey: testWalletAddress })
      .expect(200);

    return (verifyResponse.body as TokenResponse).accessToken;
  }

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

    testKeypair = Keypair.random();
    testWalletAddress = testKeypair.publicKey();

    // The first challenge creates the user and seeds default preferences.
    accessToken = await authenticate();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('authentication', () => {
    it('should reject GET /notifications/preferences without a token', async () => {
      await request(httpServer).get('/notifications/preferences').expect(401);
    });

    it('should reject PATCH /notifications/preferences without a token', async () => {
      await request(httpServer)
        .patch('/notifications/preferences')
        .send([
          { channel: 'email', enabled: true, eventTypes: ['ESCROW_FUNDED'] },
        ])
        .expect(401);
    });
  });

  describe('GET /notifications/preferences', () => {
    it('should return default preferences seeded on signup', async () => {
      const response = await request(httpServer)
        .get('/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PreferenceResponse[];
      expect(Array.isArray(body)).toBe(true);

      const channels = body.map((p) => p.channel).sort();
      expect(channels).toEqual(['email', 'webhook']);

      for (const pref of body) {
        expect(pref.enabled).toBe(true);
        expect(pref.eventTypes).toContain('ESCROW_FUNDED');
      }
    });
  });

  describe('PATCH /notifications/preferences', () => {
    it('should update and persist preferences for the authenticated user', async () => {
      await request(httpServer)
        .patch('/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          { channel: 'email', enabled: true, eventTypes: ['ESCROW_FUNDED'] },
          {
            channel: 'webhook',
            enabled: false,
            eventTypes: ['DISPUTE_RAISED'],
          },
        ])
        .expect(200);

      const response = await request(httpServer)
        .get('/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as PreferenceResponse[];
      const emailPref = body.find((p) => p.channel === 'email');
      const webhookPref = body.find((p) => p.channel === 'webhook');

      expect(emailPref).toBeDefined();
      expect(emailPref?.enabled).toBe(true);
      expect(emailPref?.eventTypes).toEqual(['ESCROW_FUNDED']);

      expect(webhookPref).toBeDefined();
      expect(webhookPref?.enabled).toBe(false);
      expect(webhookPref?.eventTypes).toEqual(['DISPUTE_RAISED']);
    });

    it('should reject an invalid channel with 400', async () => {
      await request(httpServer)
        .patch('/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          { channel: 'sms', enabled: true, eventTypes: ['ESCROW_FUNDED'] },
        ])
        .expect(400);
    });

    it('should reject an invalid event type with 400', async () => {
      await request(httpServer)
        .patch('/notifications/preferences')
        .set('Authorization', `Bearer ${accessToken}`)
        .send([
          { channel: 'email', enabled: true, eventTypes: ['NOT_A_REAL_EVENT'] },
        ])
        .expect(400);
    });
  });
});
