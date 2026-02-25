import { AuthGuard } from '@nestjs/passport';
import { EscrowsService } from './escrow.service';
import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    roles: string[];
  };
}

@Controller('escrows')
@UseGuards(AuthGuard)
export class EscrowsController {
  constructor(private readonly escrowsService: EscrowsService) {}

  @Get(':id')
  async getEscrow(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.escrowsService.getEscrowDetail(id, req.user);
  }
}
