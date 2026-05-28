import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

import { ApiProperty } from '@nestjs/swagger';

export class ChallengeDto {
  @ApiProperty({
    description: 'The Stellar public wallet address requesting the challenge',
    example: 'GCP2QYMXO3RQC522E5C3WJHRQZVNYE463O5BZZRKY3H2X7D3R27R53C2',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 56)
  @Matches(/^G[A-Z0-9]{55}$/)
  walletAddress: string;
}

export class VerifyDto {
  @ApiProperty({
    description: 'The Stellar public wallet address',
    example: 'GCP2QYMXO3RQC522E5C3WJHRQZVNYE463O5BZZRKY3H2X7D3R27R53C2',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 56)
  @Matches(/^G[A-Z0-9]{55}$/)
  walletAddress: string;

  @ApiProperty({
    description: 'The signature produced by signing the challenge string',
    example: '8b4...f1c',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  signature: string;

  @ApiProperty({
    description: 'The public key to verify the signature against (usually same as walletAddress)',
    example: 'GCP2QYMXO3RQC522E5C3WJHRQZVNYE463O5BZZRKY3H2X7D3R27R53C2',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  @Length(1, 56)
  @Matches(/^G[A-Z0-9]{55}$/)
  publicKey: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: 'The valid refresh token to obtain a new access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty({
    description: 'The refresh token to invalidate during logout',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
  })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
