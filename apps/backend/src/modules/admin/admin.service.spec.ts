import { Test, TestingModule } from '@nestjs/testing';
import { AdminService } from './admin.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User, UserRole } from '../user/entities/user.entity';
import { Escrow, EscrowStatus } from '../escrow/entities/escrow.entity';
import { Party } from '../escrow/entities/party.entity';
import { EscrowEvent } from '../escrow/entities/escrow-event.entity';
import { AdminAuditLogService } from './services/admin-audit-log.service';
import { Repository } from 'typeorm';

describe('AdminService', () => {
  let service: AdminService;
  let userRepo: jest.Mocked<any>;
  let escrowRepo: jest.Mocked<any>;
  let auditLogService: jest.Mocked<AdminAuditLogService>;

  beforeEach(async () => {
    userRepo = {
      findAndCount: jest
        .fn()
        .mockResolvedValue([
          [{ id: 'u1', isActive: true, role: UserRole.USER }],
          1,
        ]),
      count: jest.fn().mockResolvedValue(1),
      findOne: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        getRawMany: jest
          .fn()
          .mockResolvedValue([{ role: UserRole.USER, count: '1' }]),
      }),
    };

    escrowRepo = {
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '100' }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: getRepositoryToken(Escrow),
          useValue: escrowRepo,
        },
        {
          provide: getRepositoryToken(Party),
          useValue: {},
        },
        {
          provide: getRepositoryToken(EscrowEvent),
          useValue: {},
        },
        {
          provide: AdminAuditLogService,
          useValue: {
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    auditLogService = module.get(AdminAuditLogService);
  });

  describe('getAllUsers', () => {
    it('should return paginated users', async () => {
      const result = await service.getAllUsers(1, 10);
      expect(result.users).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe('getAllEscrows', () => {
    it('should return paginated escrows with filters', async () => {
      const result = await service.getAllEscrows({
        status: EscrowStatus.ACTIVE,
      });
      expect(escrowRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: EscrowStatus.ACTIVE },
        }),
      );
      expect(result.escrows).toHaveLength(0);
    });
  });

  describe('getPlatformStats', () => {
    it('should aggregate various platform stats', async () => {
      const result = await service.getPlatformStats();
      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('escrows');
      expect(result).toHaveProperty('volume');
      expect(result.volume.totalCompleted).toBe(100);
    });
  });

  describe('suspendUser', () => {
    it('should suspend a normal user', async () => {
      const mockUser = { id: 'u1', role: UserRole.USER, isActive: true };
      userRepo.findOne.mockResolvedValue(mockUser);

      const result = await service.suspendUser('u1', 'admin-id');

      expect(mockUser.isActive).toBe(false);
      expect(userRepo.save).toHaveBeenCalled();
      expect(auditLogService.create).toHaveBeenCalled();
      expect(result.message).toBe('User suspended successfully');
    });

    it('should throw if user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.suspendUser('u1')).rejects.toThrow('User not found');
    });

    it('should throw if user is super admin', async () => {
      const superAdmin = { id: 's1', role: UserRole.SUPER_ADMIN };
      userRepo.findOne.mockResolvedValue(superAdmin);
      await expect(service.suspendUser('s1')).rejects.toThrow(
        'Cannot suspend super admin',
      );
    });
  });
});
