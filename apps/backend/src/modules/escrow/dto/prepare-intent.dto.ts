import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { SorobanOperation } from '../entities/soroban-tx-intent.entity';

export class PrepareIntentDto {
  @ApiProperty({
    enum: SorobanOperation,
    description:
      'Contract entrypoint to prepare. CREATE_ESCROW registers the escrow on-chain; DEPOSIT_FUNDS funds an already-created escrow.',
  })
  @IsEnum(SorobanOperation)
  operation: SorobanOperation;

  @ApiPropertyOptional({
    description:
      'Source account the wallet will sign as. Defaults to the authenticated wallet address. Must be a valid Stellar account.',
    example: 'GBC3ZGZ6HTJGS5Y3MHPCFXJQJ6H5FD2JQH3KJWN6YW4A5Y2ZQ2Y2Y2Y2Y',
  })
  @IsOptional()
  @IsString()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'sourceAccount must be a valid Stellar public key',
  })
  sourceAccount?: string;
}

/** One `require_auth` entry the simulation reported. */
export class AuthorizationRequirementDto {
  @ApiProperty({
    description:
      'Authorization type reported by the host, e.g. source_account.',
  })
  type: string;

  @ApiProperty({ description: 'Address that must authorize the call.' })
  address: string;
}

/** Finite time bounds baked into the prepared transaction. */
export class IntentTimeBoundsDto {
  @ApiProperty({ description: 'Lower time bound (unix seconds).' })
  minTime: number;

  @ApiProperty({
    description:
      'Upper time bound (unix seconds). The envelope is only valid until here, independently of the intent TTL.',
  })
  maxTime: number;
}

export class PrepareIntentResponseDto {
  @ApiProperty({ description: 'Intent id to echo back on submission.' })
  intentId: string;

  @ApiProperty({ enum: SorobanOperation })
  operation: SorobanOperation;

  @ApiProperty({ description: 'Database escrow id.' })
  escrowId: string;

  @ApiProperty({
    description:
      'The u64 the contract will use, frozen into the intent. Always returned as a string because u64 exceeds JS safe integers.',
  })
  onChainEscrowId: string;

  @ApiProperty({ description: 'Account the wallet must sign as.' })
  sourceAccount: string;

  @ApiProperty({ description: 'Network passphrase the envelope is bound to.' })
  networkPassphrase: string;

  @ApiProperty({ description: 'Contract the simulation was run against.' })
  contractId: string;

  @ApiProperty({
    description:
      'Base64 unsigned transaction envelope. Sign this and return the signed envelope to the submission endpoint.',
  })
  unsignedXdr: string;

  @ApiProperty({
    description: 'Total fee in stroops after assembly (inclusion + resource).',
  })
  feeStroops: string;

  @ApiProperty({
    description:
      'Resource fee portion of feeStroops, as reported by the simulation. Already included in feeStroops, not additive.',
  })
  resourceFeeStroops: string;

  @ApiProperty({ description: 'Ledger the simulation was evaluated against.' })
  simulatedAtLedger: string;

  @ApiProperty({ type: [AuthorizationRequirementDto] })
  authRequirements: AuthorizationRequirementDto[];

  @ApiProperty({ type: IntentTimeBoundsDto })
  timeBounds: IntentTimeBoundsDto;

  @ApiProperty({
    description:
      'When this intent stops being submittable. After this the server rejects the signed envelope.',
  })
  expiresAt: string;
}
