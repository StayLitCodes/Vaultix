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
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiOkResponse,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

interface AuthenticatedRequest {
  user: {
    sub: string;
    id?: string;
  };
}

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
@UseGuards(AuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create API Key', description: 'Creates a new API key for the authenticated user.' })
  @ApiOkResponse({ description: 'API Key created' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateApiKeyDto) {
    const userId = req.user.sub;
    return this.apiKeysService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List API Keys', description: 'Lists all API keys for the authenticated user.' })
  @ApiOkResponse({ description: 'List of API keys retrieved' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async list(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.apiKeysService.list(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke API Key', description: 'Revokes an API key by its ID.' })
  @ApiOkResponse({ description: 'API Key revoked' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  async revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.apiKeysService.revoke(id, userId);
  }
}
