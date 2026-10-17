import { BadRequestException } from '@nestjs/common';
import { EscrowStatus } from './entities/escrow.entity';

export const validTransitions: Record<EscrowStatus, EscrowStatus[]> = {
  [EscrowStatus.PENDING]: [
    EscrowStatus.ACTIVE,
    EscrowStatus.CANCELLED,
    EscrowStatus.EXPIRED,
  ],
  [EscrowStatus.ACTIVE]: [
    EscrowStatus.COMPLETED,
    EscrowStatus.CANCELLED,
    EscrowStatus.DISPUTED,
    EscrowStatus.EXPIRED,
    EscrowStatus.REFUNDED,
  ],
  [EscrowStatus.DISPUTED]: [
    EscrowStatus.COMPLETED,
    EscrowStatus.CANCELLED,
    EscrowStatus.EXPIRED,
  ],
  [EscrowStatus.COMPLETED]: [],
  [EscrowStatus.CANCELLED]: [],
  [EscrowStatus.EXPIRED]: [],
  [EscrowStatus.REFUNDED]: [],
};

export function canTransition(
  currentStatus: EscrowStatus,
  newStatus: EscrowStatus,
): boolean {
  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

export function validateTransition(
  currentStatus: EscrowStatus,
  newStatus: EscrowStatus,
): void {
  if (!canTransition(currentStatus, newStatus)) {
    throw new BadRequestException(
      `Invalid status transition from '${currentStatus}' to '${newStatus}'`,
    );
  }
}

export function isTerminalStatus(status: EscrowStatus): boolean {
  return (
    status === EscrowStatus.COMPLETED ||
    status === EscrowStatus.CANCELLED ||
    status === EscrowStatus.EXPIRED ||
    status === EscrowStatus.REFUNDED
  );
}

export interface EscrowBalanceState {
  depositedAmount: bigint;
  releasedAmount: bigint;
}

export function assertFundsConserved(state: EscrowBalanceState): void {
  if (state.releasedAmount < 0n || state.depositedAmount < 0n || state.releasedAmount > state.depositedAmount) {
    throw new BadRequestException(
      `Escrow funds violated: released ${state.releasedAmount} of deposited ${state.depositedAmount}`,
    );
  }
}
