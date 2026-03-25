import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepository } from 'typeorm';
import { User, UserRole } from '../src/modules/user/entities/user.entity';

describe('Admin API (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test users
    const userRepository = getRepository(User);

    const admin = userRepository.create({
      walletAddress: 'ADMIN_TEST_WALLET',
      role: UserRole.ADMIN,
      isActive: true,
    });
    await userRepository.save(admin);

    const regularUser = userRepository.create({
      walletAddress: 'USER_TEST_WALLET',
      role: UserRole.USER,
      isActive: true,
    });
    await userRepository.save(regularUser);

    // Get tokens (simplified for testing)
    adminToken = 'admin-jwt-token';
    userToken = 'user-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/admin/escrows (GET)', () => {
    it('should return all escrows for admin', () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      return request(server)
        .get('/admin/escrows')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should forbid access for regular users', () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      return request(server)
        .get('/admin/escrows')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('/admin/users (GET)', () => {
    it('should return all users for admin', () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      return request(server)
        .get('/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should forbid access for regular users', () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      return request(server)
        .get('/admin/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('/admin/stats (GET)', () => {
    it('should return platform statistics for admin', () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      return request(server)
        .get('/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should forbid access for regular users', () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      return request(server)
        .get('/admin/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  describe('/admin/users/:id/suspend (POST)', () => {
    it('should suspend user for admin', () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      return request(server)
        .post('/admin/users/test-user-id/suspend')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('should forbid access for regular users', () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      return request(server)
        .post('/admin/users/test-user-id/suspend')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });
});
