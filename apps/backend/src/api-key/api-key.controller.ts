import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AuthGuard } from '../modules/auth/middleware/auth.guard';
import { ApiKeysService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface AuthenticatedRequest {
  user: {
    sub: string;
    id?: string;
  };
}

@Controller('api-keys')
@UseGuards(AuthGuard)
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

  @Delete(':id')
  async revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.apiKeysService.revoke(id, userId);
  }
}
