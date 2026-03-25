import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

export class ChallengeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 56)
  @Matches(/^G[A-Z0-9]{55}$/)
  walletAddress: string;
}

export class VerifyDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 56)
  @Matches(/^G[A-Z0-9]{55}$/)
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  signature: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 56)
  @Matches(/^G[A-Z0-9]{55}$/)
  publicKey: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LogoutDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
