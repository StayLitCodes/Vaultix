import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { AdminGuard } from '../auth/middleware/admin.guard';
import { AdminService } from './admin.service';
import { AdminAuditLogService } from './services/admin-audit-log.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { EscrowStatus } from '../escrow/entities/escrow.entity';
import { UserRole } from '../user/entities/user.entity';

interface AuditLogQuery {
  actorId?: string;
  actionType?: string;
  resourceType?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
}

interface EscrowQuery {
  status?: EscrowStatus;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

interface PaginationQuery {
  page?: number;
  limit?: number;
}

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAuditLogService: AdminAuditLogService,
    private readonly auditLogService: AuditLogService,
  ) {}

  @Get('audit-logs')
  async getAuditLogs(
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('action') action?: string,
    @Query('actorId') actorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '50',
  ) {
    const parsedPage = Number.parseInt(page, 10);
    const parsedPageSize = Number.parseInt(pageSize, 10);

    return this.auditLogService.findAll({
      entityType,
      entityId,
      action,
      actorId,
      page: Number.isNaN(parsedPage) ? 1 : parsedPage,
      pageSize: Number.isNaN(parsedPageSize) ? 50 : parsedPageSize,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Get('escrows')
  async getAllEscrows(@Query() query: EscrowQuery) {
    return this.adminService.getAllEscrows(query);
  }

  @Get('users')
  async getAllUsers(@Query() query: PaginationQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.adminService.getAllUsers(page, limit);
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(
    @Param('id') id: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.adminService.suspendUser(id, actorId);
  }

  @Post('users/:id/role')
  @HttpCode(HttpStatus.OK)
  async changeUserRole(
    @Param('id') id: string,
    @Query('role') role: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.adminService.changeUserRole(id, role as UserRole, actorId);
  }
}
