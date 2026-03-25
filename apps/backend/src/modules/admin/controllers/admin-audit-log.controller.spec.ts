import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from '../admin.controller';
import { AdminService } from '../admin.service';
import { AdminAuditLogService } from '../services/admin-audit-log.service';
import { AdminGuard } from '../../auth/middleware/admin.guard';
import { AuthGuard } from '../../auth/middleware/auth.guard';

describe('AdminController (audit log endpoint)', () => {
  let controller: AdminController;
  let auditLogService: AdminAuditLogService;

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
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    auditLogService = module.get<AdminAuditLogService>(AdminAuditLogService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call auditLogService.findAll with filters', async () => {
    const spy = jest.spyOn(auditLogService, 'findAll');
    await controller.getAuditLogs(
      'admin-1',
      'SUSPEND_USER',
      'USER',
      'user-123',
      undefined,
      undefined,
      '1',
      '10',
    );
    expect(spy).toHaveBeenCalledWith({
      actorId: 'admin-1',
      actionType: 'SUSPEND_USER',
      resourceType: 'USER',
      resourceId: 'user-123',
      page: 1,
      pageSize: 10,
      from: undefined,
      to: undefined,
    });
  });
});
