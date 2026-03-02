import { BadRequestException } from '@nestjs/common';
import { EscrowStatus } from './entities/escrow.entity';
import {
  canTransition,
  validateTransition,
  isTerminalStatus,
} from './escrow-state-machine';

describe('EscrowStateMachine', () => {
  describe('canTransition', () => {
    it('should allow PENDING -> ACTIVE', () => {
      expect(canTransition(EscrowStatus.PENDING, EscrowStatus.ACTIVE)).toBe(
        true,
      );
    });

    it('should allow PENDING -> CANCELLED', () => {
      expect(canTransition(EscrowStatus.PENDING, EscrowStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('should allow ACTIVE -> COMPLETED', () => {
      expect(canTransition(EscrowStatus.ACTIVE, EscrowStatus.COMPLETED)).toBe(
        true,
      );
    });

    it('should allow ACTIVE -> CANCELLED', () => {
      expect(canTransition(EscrowStatus.ACTIVE, EscrowStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('should allow ACTIVE -> DISPUTED', () => {
      expect(canTransition(EscrowStatus.ACTIVE, EscrowStatus.DISPUTED)).toBe(
        true,
      );
    });

    it('should allow DISPUTED -> COMPLETED', () => {
      expect(canTransition(EscrowStatus.DISPUTED, EscrowStatus.COMPLETED)).toBe(
        true,
      );
    });

    it('should allow DISPUTED -> CANCELLED', () => {
      expect(canTransition(EscrowStatus.DISPUTED, EscrowStatus.CANCELLED)).toBe(
        true,
      );
    });

    it('should not allow transitions from COMPLETED', () => {
      expect(canTransition(EscrowStatus.COMPLETED, EscrowStatus.PENDING)).toBe(
        false,
      );
      expect(canTransition(EscrowStatus.COMPLETED, EscrowStatus.ACTIVE)).toBe(
        false,
      );
      expect(
        canTransition(EscrowStatus.COMPLETED, EscrowStatus.CANCELLED),
      ).toBe(false);
    });

    it('should not allow transitions from CANCELLED', () => {
      expect(canTransition(EscrowStatus.CANCELLED, EscrowStatus.PENDING)).toBe(
        false,
      );
      expect(canTransition(EscrowStatus.CANCELLED, EscrowStatus.ACTIVE)).toBe(
        false,
      );
      expect(
        canTransition(EscrowStatus.CANCELLED, EscrowStatus.COMPLETED),
      ).toBe(false);
    });

    it('should not allow PENDING -> COMPLETED directly', () => {
      expect(canTransition(EscrowStatus.PENDING, EscrowStatus.COMPLETED)).toBe(
        false,
      );
    });

    it('should not allow PENDING -> DISPUTED directly', () => {
      expect(canTransition(EscrowStatus.PENDING, EscrowStatus.DISPUTED)).toBe(
        false,
      );
    });

    it('should allow PENDING -> EXPIRED', () => {
      expect(canTransition(EscrowStatus.PENDING, EscrowStatus.EXPIRED)).toBe(
        true,
      );
    });

    it('should allow ACTIVE -> EXPIRED', () => {
      expect(canTransition(EscrowStatus.ACTIVE, EscrowStatus.EXPIRED)).toBe(
        true,
      );
    });

    it('should allow DISPUTED -> EXPIRED', () => {
      expect(canTransition(EscrowStatus.DISPUTED, EscrowStatus.EXPIRED)).toBe(
        true,
      );
    });

    it('should not allow transitions from EXPIRED', () => {
      expect(canTransition(EscrowStatus.EXPIRED, EscrowStatus.PENDING)).toBe(
        false,
      );
      expect(canTransition(EscrowStatus.EXPIRED, EscrowStatus.ACTIVE)).toBe(
        false,
      );
      expect(canTransition(EscrowStatus.EXPIRED, EscrowStatus.COMPLETED)).toBe(
        false,
      );
    });
  });

  describe('validateTransition', () => {
    it('should not throw for valid transitions', () => {
      expect(() =>
        validateTransition(EscrowStatus.PENDING, EscrowStatus.ACTIVE),
      ).not.toThrow();
    });

    it('should throw BadRequestException for invalid transitions', () => {
      expect(() =>
        validateTransition(EscrowStatus.PENDING, EscrowStatus.COMPLETED),
      ).toThrow(BadRequestException);
    });

    it('should include status names in error message', () => {
      expect(() =>
        validateTransition(EscrowStatus.COMPLETED, EscrowStatus.ACTIVE),
      ).toThrow("Invalid status transition from 'completed' to 'active'");
    });
  });

  describe('isTerminalStatus', () => {
    it('should return true for COMPLETED', () => {
      expect(isTerminalStatus(EscrowStatus.COMPLETED)).toBe(true);
    });

    it('should return true for CANCELLED', () => {
      expect(isTerminalStatus(EscrowStatus.CANCELLED)).toBe(true);
    });

    it('should return true for EXPIRED', () => {
      expect(isTerminalStatus(EscrowStatus.EXPIRED)).toBe(true);
    });

    it('should return false for PENDING', () => {
      expect(isTerminalStatus(EscrowStatus.PENDING)).toBe(false);
    });

    it('should return false for ACTIVE', () => {
      expect(isTerminalStatus(EscrowStatus.ACTIVE)).toBe(false);
    });

    it('should return false for DISPUTED', () => {
      expect(isTerminalStatus(EscrowStatus.DISPUTED)).toBe(false);
    });
  });
});
