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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { AdminGuard } from '../auth/middleware/admin.guard';
import { AdminService } from './admin.service';
import { AdminAuditLogService } from './services/admin-audit-log.service';
import { EscrowStatus } from '../escrow/entities/escrow.entity';

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
@ApiTags('admin')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminAuditLogService: AdminAuditLogService,
  ) {}

  @Get('audit-logs')
  @ApiOperation({ summary: 'List admin audit logs with optional filters' })
  @ApiQuery({ name: 'actorId', required: false, description: 'Filter by actor user ID' })
  @ApiQuery({ name: 'actionType', required: false, description: 'Filter by action type' })
  @ApiQuery({ name: 'resourceType', required: false, description: 'Filter by resource type' })
  @ApiQuery({ name: 'resourceId', required: false, description: 'Filter by resource ID' })
  @ApiQuery({ name: 'from', required: false, description: 'Filter logs created after this date' })
  @ApiQuery({ name: 'to', required: false, description: 'Filter logs created before this date' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'pageSize', required: false, description: 'Page size' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
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
  @ApiOperation({ summary: 'List escrows across the platform for admin review' })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by escrow status' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Escrows retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  async getAllEscrows(@Query() query: EscrowQuery) {
    return this.adminService.getAllEscrows(query);
  }

  @Get('users')
  @ApiOperation({ summary: 'List platform users for admin review' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Users retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  async getAllUsers(@Query() query: PaginationQuery) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.adminService.getAllUsers(page, limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get aggregate platform statistics' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Platform stats retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend a platform user account' })
  @ApiParam({ name: 'id', description: 'User ID to suspend' })
  @ApiQuery({ name: 'actorId', required: false, description: 'Admin actor identifier' })
  @ApiResponse({ status: HttpStatus.OK, description: 'User suspended successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid suspend request' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  async suspendUser(
    @Param('id') id: string,
    @Query('actorId') actorId?: string,
  ) {
    return this.adminService.suspendUser(id, actorId);
  }
}
