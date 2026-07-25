import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from '../admin.controller';
import { AdminService } from '../admin.service';
import { AdminAuditLogService } from '../services/admin-audit-log.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { AuthGuard } from '../../auth/middleware/auth.guard';

describe('AdminController (audit log endpoint)', () => {
  let controller: AdminController;
  let auditLogService: AuditLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {},
        },
        {
          provide: AdminAuditLogService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
          },
        },
        {
          provide: AuditLogService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    auditLogService = module.get<AuditLogService>(AuditLogService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call auditLogService.findAll with filters', async () => {
    const spy = jest.spyOn(auditLogService, 'findAll');
    await controller.getAuditLogs(
      'escrow',
      'escrow-123',
      'escrow.created',
      'user-1',
      undefined,
      undefined,
      '1',
      '50',
    );
    expect(spy).toHaveBeenCalledWith({
      entityType: 'escrow',
      entityId: 'escrow-123',
      action: 'escrow.created',
      actorId: 'user-1',
      page: 1,
      pageSize: 50,
      from: undefined,
      to: undefined,
    });
  });
});
