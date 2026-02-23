import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  Req,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request as ExpressRequest } from 'express';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { EscrowAccessGuard } from '../guards/escrow-access.guard';
import { EscrowService } from '../services/escrow.service';
import { CreateEscrowDto } from '../dto/create-escrow.dto';
import { UpdateEscrowDto } from '../dto/update-escrow.dto';
import { ListEscrowsDto } from '../dto/list-escrows.dto';
import { CancelEscrowDto } from '../dto/cancel-escrow.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: { sub: string; walletAddress: string };
}

@Controller('escrows')
@UseGuards(ThrottlerGuard, AuthGuard)
export class EscrowController {
  constructor(private readonly escrowService: EscrowService) {}

  @Post()
  async create(
    @Body() dto: CreateEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.create(dto, userId, ipAddress);
  }

  @Get()
  async findAll(
    @Query() query: ListEscrowsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    return this.escrowService.findAll(userId, query);
  }

  @Get(':id')
  @UseGuards(EscrowAccessGuard)
  async findOne(@Param('id') id: string) {
    return this.escrowService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(EscrowAccessGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.update(id, dto, userId, ipAddress);
  }

  @Post(':id/cancel')
  @UseGuards(EscrowAccessGuard)
  async cancel(
    @Param('id') id: string,
    @Body() dto: CancelEscrowDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = req.user.sub;
    const ipAddress = req.ip || req.socket?.remoteAddress;
    return this.escrowService.cancel(id, dto, userId, ipAddress);
  }

  @Post(':id/release')
  @UseGuards(AuthGuard)
  async releaseEscrow(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    const escrow = await this.escrowService.releaseEscrow(
      id,
      req.user.sub,
      true, // manual trigger
    );

    return {
      id: escrow.id,
      status: escrow.status,
      transactionHash: escrow.releaseTransactionHash,
    };
  }
}
