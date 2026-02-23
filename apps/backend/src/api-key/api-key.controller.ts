import { Controller, Post, Get, Patch, Param, Body, Req, UseGuards } from '@nestjs/common';
import { ApiKeysService } from './api-key.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('api-keys')
@UseGuards(AuthGuard)
export class ApiKeysController {
  constructor(private service: ApiKeysService) {}

  @Post()
  create(@Req() req, @Body() dto) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  list(@Req() req) {
    return this.service.list(req.user.id);
  }

  @Patch(':id')
  revoke(@Param('id') id: string, @Req() req) {
    return this.service.revoke(id, req.user.id);
  }
}
