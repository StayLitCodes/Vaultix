import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import type { Server } from 'http';
import { Keypair } from 'stellar-sdk';
import { createTestApp } from '../setup/test-app.factory';
import { IpfsService } from '../../src/modules/ipfs/ipfs.service';
import {
  AVATAR_ERROR_MESSAGES,
  AVATAR_MAX_SIZE_BYTES,
} from '../../src/modules/auth/utils/avatar-upload.util';
import {
  createGifBuffer,
  createJpegBuffer,
  createMalformedPngBuffer,
  createPngBuffer,
  createTextBuffer,
  createWebpBuffer,
} from '../setup/avatar-fixtures';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

describe('POST /auth/profile/avatar (e2e)', () => {
  let app: INestApplication;
  let httpServer: Server;
  let accessToken: string;

  const uploadFile = jest.fn();
  const getGatewayUrl = jest.fn(
    (cid: string) => `https://gateway.pinata.cloud/ipfs/${cid}`,
  );

  beforeAll(async () => {
    app = await createTestApp(
      (builder) =>
        builder.overrideProvider(IpfsService).useValue({
          uploadFile,
          getGatewayUrl,
          pinJson: jest.fn(),
          getJson: jest.fn(),
          pinMetadata: jest.fn(),
          verifyMetadata: jest.fn(),
        }),
      (appInstance) => {
        appInstance.useGlobalPipes(
          new ValidationPipe({ whitelist: true, transform: true }),
        );
      },
    );
    httpServer = app.getHttpServer() as Server;

    const keypair = Keypair.random();
    const challengeResponse = await request(httpServer)
      .post('/auth/challenge')
      .send({ walletAddress: keypair.publicKey() })
      .expect(200);

    const message = (challengeResponse.body as { message: string }).message;
    const signature = keypair.sign(Buffer.from(message)).toString('hex');

    const verifyResponse = await request(httpServer)
      .post('/auth/verify')
      .send({ signature, publicKey: keypair.publicKey() })
      .expect(200);

    accessToken = (verifyResponse.body as TokenResponse).accessToken;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    uploadFile.mockClear();
    getGatewayUrl.mockClear();
  });

  const upload = (buffer: Buffer, filename: string, contentType: string) =>
    request(httpServer)
      .post('/auth/profile/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .attach('avatar', buffer, { filename, contentType });

  it('rejects a request without a file', async () => {
    const response = await request(httpServer)
      .post('/auth/profile/avatar')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(400);

    expect(response.body.message).toBe(AVATAR_ERROR_MESSAGES.MISSING_FILE);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('rejects an empty file', async () => {
    const response = await upload(Buffer.alloc(0), 'avatar.png', 'image/png')
      .expect(400);

    expect(response.body.message).toBe(AVATAR_ERROR_MESSAGES.EMPTY_FILE);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('rejects an image above the documented size limit', async () => {
    const oversized = Buffer.alloc(AVATAR_MAX_SIZE_BYTES + 1, 0x41);

    const response = await upload(oversized, 'avatar.png', 'image/png')
      .expect(413);

    expect(response.body.message).toBe(AVATAR_ERROR_MESSAGES.FILE_TOO_LARGE);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('rejects a spoofed MIME type before uploading', async () => {
    const response = await upload(
      createTextBuffer(),
      'avatar.png',
      'image/png',
    ).expect(400);

    expect(response.body.message).toBe(AVATAR_ERROR_MESSAGES.UNSUPPORTED_TYPE);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('rejects an unsupported declared type', async () => {
    const response = await upload(
      createPngBuffer(),
      'avatar.svg',
      'image/svg+xml',
    ).expect(400);

    expect(response.body.message).toBe(AVATAR_ERROR_MESSAGES.UNSUPPORTED_TYPE);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('rejects malformed image data before uploading', async () => {
    const response = await upload(
      createMalformedPngBuffer(),
      'avatar.png',
      'image/png',
    ).expect(400);

    expect(response.body.message).toBe(AVATAR_ERROR_MESSAGES.MALFORMED_FILE);
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it('uploads a valid PNG and returns consistent profile metadata', async () => {
    const buffer = createPngBuffer();
    uploadFile.mockResolvedValueOnce('QmPngCid');

    const response = await upload(buffer, 'avatar.png', 'image/png').expect(
      201,
    );

    expect(uploadFile).toHaveBeenCalledTimes(1);
    expect(uploadFile).toHaveBeenCalledWith(buffer, 'avatar.png');
    expect(response.body.avatarUrl).toBe(
      'https://gateway.pinata.cloud/ipfs/QmPngCid',
    );
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.isActive).toBe(true);

    // The upload response must carry the same profile metadata as /auth/me.
    const me = await request(httpServer)
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Object.keys(response.body).sort()).toEqual(
      Object.keys(me.body).sort(),
    );
    expect(response.body).toEqual({
      ...me.body,
      avatarUrl: 'https://gateway.pinata.cloud/ipfs/QmPngCid',
    });
  });

  it('uploads the other supported image formats', async () => {
    const cases = [
      { buffer: createJpegBuffer(), format: 'jpeg' },
      { buffer: createGifBuffer(), format: 'gif' },
      { buffer: createWebpBuffer(), format: 'webp' },
    ];

    for (const testCase of cases) {
      uploadFile.mockResolvedValueOnce(`Qm-${testCase.format}`);

      const response = await upload(
        testCase.buffer,
        `avatar.${testCase.format}`,
        `image/${testCase.format}`,
      ).expect(201);

      expect(uploadFile).toHaveBeenLastCalledWith(
        testCase.buffer,
        `avatar.${testCase.format}`,
      );
      expect(response.body.avatarUrl).toBe(
        `https://gateway.pinata.cloud/ipfs/Qm-${testCase.format}`,
      );
    }
  });

  it('requires authentication', async () => {
    await request(httpServer)
      .post('/auth/profile/avatar')
      .attach('avatar', createPngBuffer(), {
        filename: 'avatar.png',
        contentType: 'image/png',
      })
      .expect(401);

    expect(uploadFile).not.toHaveBeenCalled();
  });
});
