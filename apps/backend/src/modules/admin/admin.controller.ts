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
import { EscrowStatus } from '../escrow/entities/escrow.entity';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiQuery,
} from '@nestjs/swagger';

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

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {}

  @Get('audit-logs')
  @ApiOperation({
    summary: 'Get admin audit logs',
    description: 'Retrieves audit logs of admin actions with filtering and pagination.',
  })
  @ApiQuery({ name: 'actorId', required: false, type: String })
  @ApiQuery({ name: 'actionType', required: false, type: String })
  @ApiQuery({ name: 'resourceType', required: false, type: String })
  @ApiQuery({ name: 'resourceId', required: false, type: String })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: String })
  @ApiQuery({ name: 'pageSize', required: false, type: String })
  @ApiOkResponse({ description: 'Audit logs retrieved' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getAuditLogs(
    @Query('actorId') actorId?: string,
    @Query('actionType') actionType?: string,
    @Query('resourceType') resourceType?: string,
    @Query('resourceId') resourceId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    const parsedPage = Number.parseInt(page, 10);
    const parsedPageSize = Number.parseInt(pageSize, 10);

    const filters: AuditLogQuery = {
      actorId,
      actionType,
      resourceType,
      resourceId,
      page: Number.isNaN(parsedPage) ? 1 : parsedPage,
      pageSize: Number.isNaN(parsedPageSize) ? 20 : parsedPageSize,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    };

    return this.adminAuditLogService.findAll(filters);
  }

  @Get('escrows')
  @ApiOperation({
    summary: 'Get all escrows (Admin)',
    description: 'Retrieves a paginated list of all escrows on the platform.',
  })
  @ApiOkResponse({ description: 'List of all escrows' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getAllEscrows(@Query() query: EscrowQuery) {
    return this.adminService.getAllEscrows(query);
  }

  @Get('users')
  @ApiOperation({
    summary: 'Get all users (Admin)',
    description: 'Retrieves a paginated list of all users on the platform.',
  })
  @ApiOkResponse({ description: 'List of all users' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getAllUsers(@Query() query: PaginationQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.adminService.getAllUsers(page, limit);
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get platform stats',
    description: 'Retrieves overall platform statistics.',
  })
  @ApiOkResponse({ description: 'Platform statistics retrieved' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Suspend user',
    description: 'Suspends a user account by ID.',
  })
  @ApiOkResponse({ description: 'User successfully suspended' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async suspendUser(
    @Param('id') id: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.adminService.suspendUser(id, actorId);
  }
}
