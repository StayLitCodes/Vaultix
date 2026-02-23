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
import { EscrowStatus } from '../escrow/entities/escrow.entity';

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('escrows')
  async getAllEscrows(
    @Query()
    query: {
      status?: EscrowStatus;
      page?: number;
      limit?: number;
      startDate?: string;
      endDate?: string;
    },
  ) {
    return this.adminService.getAllEscrows(query);
  }

  @Get('users')
  async getAllUsers(@Query() query: { page?: number; limit?: number }) {
    return this.adminService.getAllUsers(query.page, query.limit);
  }

  @Get('stats')
  async getStats() {
    return this.adminService.getPlatformStats();
  }

  @Post('users/:id/suspend')
  @HttpCode(HttpStatus.OK)
  async suspendUser(@Param('id') id: string) {
    return this.adminService.suspendUser(id);
  }
}
