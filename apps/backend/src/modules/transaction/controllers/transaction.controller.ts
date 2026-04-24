import {
  Controller,
  Get,
  Query,
  UseGuards,
  Request,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../../auth/middleware/auth.guard';
import { TransactionService } from '../services/transaction.service';
import { ListTransactionsDto } from '../dto/list-transactions.dto';
import { PaginatedTransactionsResponseDto } from '../dto/transaction-response.dto';
import { Request as ExpressRequest } from 'express';

interface AuthenticatedRequest extends ExpressRequest {
  user: { sub?: string; userId?: string; walletAddress: string };
}

@Controller('transactions')
@ApiTags('transactions')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class TransactionController {
  constructor(private readonly transactionService: TransactionService) {}

  private getAuthenticatedUserId(req: AuthenticatedRequest): string {
    const userId = req.user.sub ?? req.user.userId;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }
    return userId;
  }

  @Get()
  @ApiOperation({ summary: 'Get consolidated transaction history for authenticated user' })
  @ApiOkResponse({ type: PaginatedTransactionsResponseDto })
  async findAll(
    @Query() query: ListTransactionsDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const userId = this.getAuthenticatedUserId(req);
    const walletAddress = req.user.walletAddress;
    return this.transactionService.findAll(userId, walletAddress, query);
  }
}
