import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../modules/auth/middleware/auth.guard';
import { ApiKeyGuard } from './guards/api-key.guard';
import { ApiKeysService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

interface AuthenticatedRequest {
  user: {
    sub: string;
    id?: string;
  };
}

@Controller('api-keys')
@UseGuards(ApiKeyGuard, AuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateApiKeyDto) {
    const userId = req.user.sub;
    return this.apiKeysService.create(userId, dto);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.apiKeysService.list(userId);
  }

  @Get(':id')
  async findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.apiKeysService.findOne(id, userId);
  }

  @Patch(':id')
  async update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    const userId = req.user.sub;
    return this.apiKeysService.update(id, userId, dto);
  }

  @Delete(':id')
  async revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.apiKeysService.revoke(id, userId);
  }

  @Post(':id/rotate')
  async rotate(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.apiKeysService.rotate(id, userId);
  }
}
