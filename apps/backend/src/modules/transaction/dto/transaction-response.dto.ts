import { ApiProperty } from '@nestjs/swagger';

export class TransactionResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  type: string;

  @ApiProperty({ nullable: true })
  escrowId?: string;

  @ApiProperty({ nullable: true })
  escrowTitle?: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  asset: string;

  @ApiProperty()
  counterpartyAddress: string;

  @ApiProperty()
  txHash: string;
}

export class PaginatedTransactionsResponseDto {
  @ApiProperty({ type: [TransactionResponseDto] })
  data: TransactionResponseDto[];

  @ApiProperty()
  totalItems: number;

  @ApiProperty()
  totalPages: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  pageSize: number;
}
