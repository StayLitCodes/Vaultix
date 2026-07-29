import { IsNumber, IsPositive, Max } from 'class-validator';

export class FundEscrowDto {
  @IsNumber()
  @IsPositive()
  @Max(1e13)
  amount: number;
}
