import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChallengeDto {
  @ApiProperty({
    description: 'Stellar wallet address used to start authentication',
    example: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 56)
  @Matches(/^G[A-Z0-9]{55}$/)
  walletAddress: string;
}

export class VerifyDto {
  @ApiProperty({ description: 'Base64 or hex-encoded signature for the challenge', example: 'signature' })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'Stellar public key for the signing wallet',
    example: 'GABC1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF',
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 56)
  @Matches(/^G[A-Z0-9]{55}$/)
  publicKey: string;
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token used to mint a new access token', example: 'refresh-token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token to revoke during logout', example: 'refresh-token' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
