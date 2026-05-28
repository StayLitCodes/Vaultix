import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { AssetsService } from './assets.service';
import { CreateAssetDto, UpdateAssetDto } from './dto/asset.dto';
import { AuthGuard } from '../auth/middleware/auth.guard';
import { AdminGuard } from '../auth/middleware/admin.guard';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse, ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

@ApiTags('Assets')
@ApiBearerAuth()
@Controller('admin/assets')
@UseGuards(AuthGuard, AdminGuard)
export class AdminAssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Post()
  @ApiOperation({ summary: 'Create new asset', description: 'Adds a new supported asset to the platform.' })
  @ApiOkResponse({ description: 'Asset created' })
  @ApiForbiddenResponse({ description: 'Forbidden, requires admin privileges' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  create(@Body() createAssetDto: CreateAssetDto) {
    return this.assetsService.create(createAssetDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all assets', description: 'Retrieves a list of all assets including inactive ones.' })
  @ApiOkResponse({ description: 'List of assets retrieved' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findAll() {
    return this.assetsService.findAll(false);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get asset by ID' })
  @ApiOkResponse({ description: 'Asset details retrieved' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  findOne(@Param('id') id: string) {
    return this.assetsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update asset details' })
  @ApiOkResponse({ description: 'Asset updated successfully' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  update(@Param('id') id: string, @Body() updateAssetDto: UpdateAssetDto) {
    return this.assetsService.update(id, updateAssetDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete asset' })
  @ApiOkResponse({ description: 'Asset deleted successfully' })
  @ApiForbiddenResponse({ description: 'Forbidden' })
  @ApiUnauthorizedResponse({ description: 'Unauthorized' })
  remove(@Param('id') id: string) {
    return this.assetsService.remove(id);
  }
}
