import { IsPositive, IsString, Matches } from 'class-validator';

export class FundEscrowDto {
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,38})(?:\.\d+)?$/)
  @IsPositive()
  amount: string;
}
