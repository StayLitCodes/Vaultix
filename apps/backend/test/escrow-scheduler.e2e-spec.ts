import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import supertest from 'supertest';
import { AppModule } from '../src/app.module';
import { getRepository, In } from 'typeorm';
import {
  Escrow,
  EscrowStatus,
} from '../src/modules/escrow/entities/escrow.entity';
import { User, UserRole } from '../src/modules/user/entities/user.entity';
import { Party, PartyRole } from '../src/modules/escrow/entities/party.entity';

describe('Escrow Scheduler (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let testUser: User;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Create test user
    const userRepository = getRepository(User);
    testUser = userRepository.create({
      walletAddress: 'TEST_SCHEDULER_WALLET',
      role: UserRole.USER,
      isActive: true,
    });
    await userRepository.save(testUser);

    adminToken = 'admin-jwt-token';
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data
    const escrowRepository = getRepository(Escrow);
    const partyRepository = getRepository(Party);

    await partyRepository.delete({});
    await escrowRepository.delete({});
  });

  describe('Manual Escrow Processing', () => {
    it('should auto-cancel expired pending escrow', async () => {
      const escrowRepository = getRepository(Escrow);
      const partyRepository = getRepository(Party);

      // Create expired pending escrow
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const testEscrow = escrowRepository.create({
        title: 'Test Escrow',
        amount: 100,
        asset: 'XLM',
        status: EscrowStatus.PENDING,
        creatorId: testUser.id,
        expiresAt: pastDate,
        isActive: true,
      });
      const savedEscrow = await escrowRepository.save(testEscrow);

      // Add party
      const party = partyRepository.create({
        escrowId: savedEscrow.id,
        userId: testUser.id,
        role: PartyRole.BUYER,
      });
      await partyRepository.save(party);

      // Process manually
      const response = await supertest(app.getHttpServer())
        .post(`/escrows/scheduler/process/${savedEscrow.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('processed manually');

      // Verify escrow was cancelled
      const updatedEscrow = await escrowRepository.findOne({
        where: { id: savedEscrow.id },
      });

      expect(updatedEscrow?.status).toBe(EscrowStatus.CANCELLED);
      expect(updatedEscrow?.isActive).toBe(false);
    });

    it('should escalate expired active escrow to dispute', async () => {
      const escrowRepository = getRepository(Escrow);
      const partyRepository = getRepository(Party);

      // Create expired active escrow
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const testEscrow = escrowRepository.create({
        title: 'Test Active Escrow',
        amount: 100,
        asset: 'XLM',
        status: EscrowStatus.ACTIVE,
        creatorId: testUser.id,
        expiresAt: pastDate,
        isActive: true,
      });
      const savedEscrow = await escrowRepository.save(testEscrow);

      // Add party
      const party = partyRepository.create({
        escrowId: savedEscrow.id,
        userId: testUser.id,
        role: PartyRole.SELLER,
      });
      await partyRepository.save(party);

      // Process manually
      const response = await supertest(app.getHttpServer())
        .post(`/escrows/scheduler/process/${savedEscrow.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('processed manually');

      // Verify escrow was escalated to dispute
      const updatedEscrow = await escrowRepository.findOne({
        where: { id: savedEscrow.id },
      });

      expect(updatedEscrow?.status).toBe(EscrowStatus.DISPUTED);
    });

    it('should not process non-expired escrow', async () => {
      const escrowRepository = getRepository(Escrow);

      // Create future escrow
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);

      const testEscrow = escrowRepository.create({
        title: 'Future Escrow',
        amount: 100,
        asset: 'XLM',
        status: EscrowStatus.PENDING,
        creatorId: testUser.id,
        expiresAt: futureDate,
        isActive: true,
      });
      const savedEscrow = await escrowRepository.save(testEscrow);

      // Try to process manually
      const response = await supertest(app.getHttpServer())
        .post(`/escrows/scheduler/process/${savedEscrow.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain('has not expired yet');
    });

    it('should handle non-existent escrow', async () => {
      const response = await supertest(app.getHttpServer())
        .post('/escrows/scheduler/process/non-existent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain('Escrow not found');
    });
  });

  describe('Batch Processing', () => {
    it('should process all expired escrows', async () => {
      const escrowRepository = getRepository(Escrow);
      const partyRepository = getRepository(Party);

      // Create multiple expired escrows
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const savedEscrows: Escrow[] = [];
      for (let i = 0; i < 3; i++) {
        const escrow = escrowRepository.create({
          title: `Test Escrow ${i}`,
          amount: 100,
          asset: 'XLM',
          status: EscrowStatus.PENDING,
          creatorId: testUser.id,
          expiresAt: pastDate,
          isActive: true,
        });
        const savedEscrow = await escrowRepository.save(escrow);
        savedEscrows.push(savedEscrow);

        // Add party to each escrow
        const party = partyRepository.create({
          escrowId: savedEscrow.id,
          userId: testUser.id,
          role: PartyRole.BUYER,
        });
        await partyRepository.save(party);
      }

      // Process all expired escrows
      const response = await supertest(app.getHttpServer())
        .post('/escrows/scheduler/process-expired')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.message).toContain('processing initiated');

      // Verify all escrows were cancelled
      const updatedEscrows = await escrowRepository.find({
        where: {
          id: In(savedEscrows.map((e) => e.id)),
        },
      });

      updatedEscrows.forEach((escrow) => {
        expect(escrow.status).toBe(EscrowStatus.CANCELLED);
        expect(escrow.isActive).toBe(false);
      });
    });
  });

  describe('Access Control', () => {
    it('should forbid access for non-admin users', async () => {
      await supertest(app.getHttpServer())
        .post('/escrows/scheduler/process-expired')
        .set('Authorization', 'Bearer user-token')
        .expect(403);
    });

    it('should require authentication', async () => {
      await supertest(app.getHttpServer())
        .post('/escrows/scheduler/process-expired')
        .expect(401);
    });
  });
});
