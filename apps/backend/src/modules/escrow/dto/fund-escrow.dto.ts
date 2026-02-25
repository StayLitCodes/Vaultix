import { IsNumber, 
    IsPositive,
  } from 'class-validator';

export class FundEscrowDto {
  @IsNumber()
  @IsPositive()
  amount: number;
}
