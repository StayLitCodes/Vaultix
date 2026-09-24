import { Test, TestingModule } from '@nestjs/testing';
import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  INestApplication,
  Module,
  HttpStatus,
  HttpCode,
  Req,
  ValidationPipe,
  ExecutionContext,
  CanActivate,
  Injectable,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { AdminGuard } from '../../src/modules/auth/middleware/admin.guard';
import { SuperAdminGuard } from '../../src/modules/auth/middleware/super-admin.guard';
import { AdminAuditLog } from '../../src/modules/admin/entities/admin-audit-log.entity';
import { AdminAuditLogService } from '../../src/modules/admin/services/admin-audit-log.service';
import { RoleChangeDto } from '../../src/modules/admin/dto/role-change.dto';
import { User, UserRole } from '../../src/modules/user/entities/user.entity';

// ── Fake AuthGuard that reads role from a header ────────────────────────────
@Injectable()
class FakeAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: unknown;
    }>();
    const role = req.headers['x-test-role'] as UserRole | undefined;
    const userId = req.headers['x-test-user-id'];
    if (!role || !userId) return false;
    req.user = { userId, role, walletAddress: 'GTEST' };
    return true;
  }
}

// ── Minimal controller that mirrors the real AdminController routes ──────────
@Controller('admin')
@UseGuards(FakeAuthGuard, AdminGuard)
class TestAdminController {
  constructor(private readonly auditLogService: AdminAuditLogService) {}

  @Get('users')
  getAllUsers() {
    return {
      users: [],
      pagination: { page: 1, limit: 20, total: 0, pages: 0 },
    };
  }

  @Get('users/:id/roles')
  getUserRoles(@Param('id') _id: string) {
    return { user: { id: _id, currentRole: 'USER' }, roleHistory: [] };
  }

  @Post('users/:id/promote')
  @UseGuards(FakeAuthGuard, SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  async promoteUser(
    @Param('id') id: string,
    @Body() body: RoleChangeDto,
    @Req() req: { user: { userId: string } },
  ) {
    if (id === req.user.userId) {
      return { statusCode: 409, message: 'Cannot promote your own account' };
    }
    await this.auditLogService.create({
      actorId: req.user.userId,
      actionType: 'PROMOTE_USER',
      resourceType: 'USER',
      resourceId: id,
      metadata: { newRole: UserRole.ADMIN, reason: body.reason },
    });
    return { message: 'User promoted to ADMIN' };
  }

  @Post('users/:id/demote')
  @UseGuards(FakeAuthGuard, SuperAdminGuard)
  @HttpCode(HttpStatus.OK)
  async demoteUser(
    @Param('id') id: string,
    @Body() body: RoleChangeDto,
    @Req() req: { user: { userId: string } },
  ) {
    if (id === req.user.userId) {
      return { statusCode: 409, message: 'Cannot demote your own account' };
    }
    await this.auditLogService.create({
      actorId: req.user.userId,
      actionType: 'DEMOTE_USER',
      resourceType: 'USER',
      resourceId: id,
      metadata: { newRole: UserRole.USER, reason: body.reason },
    });
    return { message: 'User demoted to USER' };
  }
}

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: ':memory:',
      entities: [User, AdminAuditLog],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([User, AdminAuditLog]),
  ],
  controllers: [TestAdminController],
  providers: [AdminAuditLogService, FakeAuthGuard],
})
class AdminRoleTestModule {}

// ── Helpers ──────────────────────────────────────────────────────────────────
function authHeaders(role: UserRole | null, userId = 'test-user-id') {
  if (!role) return {};
  return { 'x-test-role': role, 'x-test-user-id': userId };
}

describe('Admin Role Management (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AdminRoleTestModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });

  // ─── Non-admin access ───────────────────────────────────────────────────
  describe('Non-admin access', () => {
    it('should return 403 when no auth headers are sent', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server).get('/admin/users');
      expect(res.status).toBe(403);
    });

    it('should return 403 for regular user accessing admin endpoints', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .get('/admin/users')
        .set(authHeaders(UserRole.USER));
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Admin access required/i);
    });
  });

  // ─── Admin access ───────────────────────────────────────────────────────
  describe('Admin access', () => {
    it('should return 200 for admin accessing admin endpoints', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .get('/admin/users')
        .set(authHeaders(UserRole.ADMIN));
      expect(res.status).toBe(200);
    });

    it('should return 200 for super-admin accessing admin endpoints', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .get('/admin/users')
        .set(authHeaders(UserRole.SUPER_ADMIN));
      expect(res.status).toBe(200);
    });
  });

  // ─── Super-admin-only operations ────────────────────────────────────────
  describe('Super-admin-only operations', () => {
    it('should return 403 when admin tries to promote a user', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/some-user-id/promote')
        .set(authHeaders(UserRole.ADMIN))
        .send({ reason: 'Test promotion' });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Super-admin access required/i);
    });

    it('should return 403 when admin tries to demote a user', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/some-user-id/demote')
        .set(authHeaders(UserRole.ADMIN))
        .send({ reason: 'Test demotion' });
      expect(res.status).toBe(403);
      expect(res.body.message).toMatch(/Super-admin access required/i);
    });

    it('should return 200 when super-admin promotes a user', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/target-user-id/promote')
        .set(authHeaders(UserRole.SUPER_ADMIN, 'super-admin-id'))
        .send({ reason: 'Promoting for moderation duties' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User promoted to ADMIN');
    });

    it('should return 200 when super-admin demotes a user', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/target-user-id/demote')
        .set(authHeaders(UserRole.SUPER_ADMIN, 'super-admin-id'))
        .send({ reason: 'Demoting for policy violation' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User demoted to USER');
    });

    it('should prevent super-admin from promoting self', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/super-admin-id/promote')
        .set(authHeaders(UserRole.SUPER_ADMIN, 'super-admin-id'))
        .send({ reason: 'Self promote' });
      expect(res.body.message).toBe('Cannot promote your own account');
    });

    it('should prevent super-admin from demoting self', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/super-admin-id/demote')
        .set(authHeaders(UserRole.SUPER_ADMIN, 'super-admin-id'))
        .send({ reason: 'Self demote' });
      expect(res.body.message).toBe('Cannot demote your own account');
    });
  });

  // ─── Role history ───────────────────────────────────────────────────────
  describe('Role history', () => {
    it('should return role history for a user (admin access)', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .get('/admin/users/some-user-id/roles')
        .set(authHeaders(UserRole.ADMIN));
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('roleHistory');
    });

    it('should return 403 for non-admin accessing role history', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .get('/admin/users/some-user-id/roles')
        .set(authHeaders(UserRole.USER));
      expect(res.status).toBe(403);
    });
  });

  // ─── Audit logging ──────────────────────────────────────────────────────
  describe('Audit logging', () => {
    it('should create audit log entry on promote', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      await request(server)
        .post('/admin/users/target-user-id/promote')
        .set(authHeaders(UserRole.SUPER_ADMIN, 'super-admin-id'))
        .send({ reason: 'Promoting for moderation duties' });

      const auditLogService = app.get(AdminAuditLogService);
      const logs = await auditLogService.findAll({
        actionType: 'PROMOTE_USER',
      });
      expect(logs.data.length).toBeGreaterThanOrEqual(1);
      const log = logs.data[0];
      expect(log.actorId).toBe('super-admin-id');
      expect(log.resourceId).toBe('target-user-id');
      expect(log.metadata).toEqual(
        expect.objectContaining({ reason: 'Promoting for moderation duties' }),
      );
    });

    it('should create audit log entry on demote', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      await request(server)
        .post('/admin/users/target-user-id/demote')
        .set(authHeaders(UserRole.SUPER_ADMIN, 'super-admin-id'))
        .send({ reason: 'Demoting for policy violation' });

      const auditLogService = app.get(AdminAuditLogService);
      const logs = await auditLogService.findAll({ actionType: 'DEMOTE_USER' });
      expect(logs.data.length).toBeGreaterThanOrEqual(1);
      const log = logs.data[0];
      expect(log.actorId).toBe('super-admin-id');
      expect(log.resourceId).toBe('target-user-id');
      expect(log.metadata).toEqual(
        expect.objectContaining({ reason: 'Demoting for policy violation' }),
      );
    });
  });

  // ─── Validation ─────────────────────────────────────────────────────────
  describe('Validation', () => {
    it('should reject promote without reason', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/target-user-id/promote')
        .set(authHeaders(UserRole.SUPER_ADMIN))
        .send({});
      expect(res.status).toBe(400);
    });

    it('should reject demote without reason', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/target-user-id/demote')
        .set(authHeaders(UserRole.SUPER_ADMIN))
        .send({});
      expect(res.status).toBe(400);
    });

    it('should reject reason exceeding 500 characters', async () => {
      const server = app.getHttpServer() as unknown as import('http').Server;
      const res = await request(server)
        .post('/admin/users/target-user-id/promote')
        .set(authHeaders(UserRole.SUPER_ADMIN))
        .send({ reason: 'a'.repeat(501) });
      expect(res.status).toBe(400);
    });
  });
});
