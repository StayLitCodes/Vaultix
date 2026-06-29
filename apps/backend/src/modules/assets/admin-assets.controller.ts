import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
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
import { AssetsService } from './assets.service';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { AdminGuard } from '../auth/middleware/admin.guard';

@Controller('admin/assets')
@ApiTags('admin/assets')
@ApiBearerAuth('access-token')
@UseGuards(AuthGuard, AdminGuard)
export class AdminAssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new asset' })
  @ApiBody({ type: CreateAssetDto, description: 'Asset creation payload' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Asset created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid asset payload' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.create(createAssetDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all assets including inactive ones' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Assets retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  findAll() {
    return this.assetsService.findAll(false);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an asset by ID' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Asset retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Asset not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing asset' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiBody({ type: UpdateAssetDto, description: 'Asset update payload' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Asset updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid asset payload' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Asset not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto) {
    return this.assetsService.update(id, updateAssetDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an asset by ID' })
  @ApiParam({ name: 'id', description: 'Asset ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Asset deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'Asset not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Authentication required' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Admin privileges required' })
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
