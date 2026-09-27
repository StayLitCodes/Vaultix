import { IsString, Matches } from 'class-validator';

export class FundEscrowDto {
  @IsString()
  @Matches(/^(?=.*[1-9])(?:0|[1-9]\d*)(?:\.\d{1,7})?$/)
  amount: string;
}
