import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { createTestApp } from '../setup/test-app.factory';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await createTestApp();
  });

  it('/ (GET)', () => {
    const server = app.getHttpServer() as unknown as import('http').Server;
    return request(server).get('/').expect(200).expect('Hello World!');
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });
});
