import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { IsStellarAddress } from '../../../utils/validators';

export class ChallengeDto {
  @IsStellarAddress()
  @IsNotEmpty()
  walletAddress: string;
}

export class VerifyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  signature: string;

  @IsStellarAddress()
  @IsNotEmpty()
  publicKey: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  refreshToken: string;
}
