import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  IsOptional,
  IsEmail,
  MaxLength,
} from 'class-validator';

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

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  preferredAsset?: string;
}

export class VerifyEmailDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
