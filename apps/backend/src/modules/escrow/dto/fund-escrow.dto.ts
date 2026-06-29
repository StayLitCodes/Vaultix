import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FundEscrowDto {
  @ApiProperty({ description: 'Amount to fund the escrow with', example: 250 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
