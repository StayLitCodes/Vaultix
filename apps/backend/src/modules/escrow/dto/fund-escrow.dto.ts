import { IsNumber, IsPositive } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class FundEscrowDto {
  @ApiProperty({ description: 'The amount of asset to fund', example: 100.5 })
  @IsNumber()
  @IsPositive()
  amount: number;
}
