import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { AppModule } from './../src/app.module';
import supertest from 'supertest';

// Mock Stellar keypair for testing
interface MockKeypair {
  publicKey: () => string;
  sign: (data: Buffer) => Buffer;
}

function createMockKeypair(): MockKeypair {
  const randomKey =
    'G' +
    Array.from({ length: 55 }, () =>
      'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.charAt(Math.floor(Math.random() * 32)),
    ).join('');
  return {
    publicKey: () => randomKey,
    sign: (data: Buffer) => Buffer.from(data.toString() + '-signed'),
  };
}

interface ChallengeResponse {
  nonce: string;
  message: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

interface UserResponse {
  id: string;
  walletAddress: string;
  isActive: boolean;
  createdAt: string;
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let testKeypair: MockKeypair;
  let testWalletAddress: string;
  let accessToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    httpServer = app.getHttpServer() as Server;

    // Generate a random keypair for testing
    testKeypair = createMockKeypair();
    testWalletAddress = testKeypair.publicKey();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/challenge (POST)', () => {
    it('should return a unique nonce for a wallet address', async () => {
      const response = await request(httpServer)
        .post('/auth/challenge')
        .send({ walletAddress: testWalletAddress })
        .expect(200);

      const body = response.body as ChallengeResponse;
      expect(body).toHaveProperty('nonce');
      expect(body).toHaveProperty('message');
      expect(body.message).toContain(body.nonce);
      expect(body.nonce).toMatch(/^[a-f0-9]{32}$/);
    });

    it('should return 400 for invalid wallet address', async () => {
      await request(httpServer)
        .post('/auth/challenge')
        .send({ walletAddress: 'invalid-address' })
        .expect(400);
    });
  });

  describe('/auth/verify (POST)', () => {
    it('should verify a valid signature and return tokens', async () => {
      // First get a challenge
      const challengeResponse = await request(httpServer)
        .post('/auth/challenge')
        .send({ walletAddress: testWalletAddress })
        .expect(200);

      const message = (challengeResponse.body as ChallengeResponse).message;
      const signature = testKeypair.sign(Buffer.from(message)).toString('hex');

      const response = await request(httpServer)
        .post('/auth/verify')
        .send({
          walletAddress: testWalletAddress,
          signature: signature,
          publicKey: testWalletAddress,
        })
        .expect(200);

      const body = response.body as TokenResponse;
      expect(body).toHaveProperty('accessToken');
      expect(body).toHaveProperty('refreshToken');
      expect(body.accessToken).toBeDefined();
      expect(body.refreshToken).toBeDefined();
    });

    it('should return 401 for invalid signature', async () => {
      await request(httpServer)
        .post('/auth/verify')
        .send({
          walletAddress: testWalletAddress,
          signature: 'invalid-signature',
          publicKey: testWalletAddress,
        })
        .expect(401);
    });
  });

  describe('/auth/me (GET)', () => {
    beforeEach(async () => {
      // Get a valid access token
      const challengeResponse = await request(httpServer)
        .post('/auth/challenge')
        .send({ walletAddress: testWalletAddress })
        .expect(200);

      const message = (challengeResponse.body as ChallengeResponse).message;
      const signature = testKeypair.sign(Buffer.from(message)).toString('hex');

      const verifyResponse = await request(httpServer)
        .post('/auth/verify')
        .send({
          walletAddress: testWalletAddress,
          signature: signature,
          publicKey: testWalletAddress,
        })
        .expect(200);

      accessToken = (verifyResponse.body as TokenResponse).accessToken;
    });

    it('should return current user with valid token', async () => {
      const response = await request(httpServer)
        .get('/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      const body = response.body as UserResponse;
      expect(body).toHaveProperty('id');
      expect(body).toHaveProperty('walletAddress');
      expect(body).toHaveProperty('isActive');
      expect(body).toHaveProperty('createdAt');
      expect(body.walletAddress).toBe(testWalletAddress);
      expect(body.isActive).toBe(true);
    });

    it('should return 401 without token', async () => {
      await supertest(httpServer).get('/auth/me').expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(httpServer)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });
});
