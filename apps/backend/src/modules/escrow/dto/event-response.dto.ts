import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EscrowEventType } from '../entities/escrow-event.entity';

export class EventResponseDto {
  @ApiProperty({ description: 'The unique identifier of the event', example: 'evt_123' })
  id: string;

  @ApiProperty({ description: 'The associated escrow ID', example: 'esc_456' })
  escrowId: string;

  @ApiProperty({ description: 'Type of event', enum: EscrowEventType, example: EscrowEventType.CREATED })
  eventType: EscrowEventType;

  @ApiPropertyOptional({ description: 'Actor ID who triggered the event', example: 'usr_789' })
  actorId?: string;

  @ApiPropertyOptional({ description: 'Arbitrary data associated with the event', example: { reason: 'Dispute filed' } })
  data?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'IP address of the actor', example: '192.168.1.1' })
  ipAddress?: string;

  @ApiProperty({ description: 'Event creation timestamp', example: '2026-05-28T12:00:00Z' })
  createdAt: Date;

  // Escrow details for context
  @ApiPropertyOptional({
    description: 'Basic escrow details',
    example: {
      id: 'esc_456',
      title: 'Laptop Purchase',
      amount: 500,
      assetCode: 'USDC',
      status: 'ACTIVE',
    },
  })
  escrow?: {
    id: string;
    title: string;
    amount: number;
    assetCode: string;
    assetIssuer?: string;
    status: string;
  };

  // Actor details (wallet address)
  @ApiPropertyOptional({
    description: 'Actor wallet details',
    example: { walletAddress: 'GCP2QYMX...' },
  })
  actor?: {
    walletAddress?: string;
  };
}
