import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
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
@ApiTags('api-keys')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard)
export class ApiKeyController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({ summary: 'Create an API key for the authenticated user' })
  @ApiBody({ type: CreateApiKeyDto, description: 'API key creation payload' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'API key created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid API key payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateApiKeyDto) {
    const userId = req.user.sub;
    return this.apiKeysService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List API keys for the authenticated user' })
  @ApiResponse({ status: HttpStatus.OK, description: 'API keys retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async list(@Req() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.apiKeysService.list(userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Revoke an API key by ID' })
  @ApiParam({ name: 'id', description: 'API key ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'API key revoked successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'API key not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  async revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const userId = req.user.sub;
    return this.apiKeysService.revoke(id, userId);
  }
}
