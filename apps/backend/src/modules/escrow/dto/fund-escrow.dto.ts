import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class FundEscrowDto {
  @IsNumber()
  @IsPositive()
  amount: number;

  /** Base64-encoded signed transaction envelope (wallet-signed funding tx). */
  @IsOptional()
  @IsString()
  signedTransactionXdr?: string;
}
