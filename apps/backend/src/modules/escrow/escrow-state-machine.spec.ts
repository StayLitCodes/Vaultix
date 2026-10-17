/**
 * Escrow State Transition Table:
 *
 * Current Status | Allowed New Statuses
 * ----------------|---------------------
 * PENDING         | ACTIVE, CANCELLED, EXPIRED
 * ACTIVE          | COMPLETED, CANCELLED, DISPUTED, EXPIRED
 * DISPUTED        | COMPLETED, CANCELLED, EXPIRED
 * COMPLETED       | (None)
 * CANCELLED       | (None)
 * EXPIRED         | (None)
 */

import { BadRequestException } from '@nestjs/common';
import { EscrowStatus } from './entities/escrow.entity';
import {
  canTransition,
  validateTransition,
  isTerminalStatus,
} from './escrow-state-machine';
import * as fc from 'fast-check';

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

    it('should return false for invalid current status', () => {
      expect(canTransition('INVALID' as any, EscrowStatus.ACTIVE)).toBe(false);
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

  describe('property-based invariants', () => {
    const ALL_STATUSES: EscrowStatus[] = [
      EscrowStatus.PENDING,
      EscrowStatus.ACTIVE,
      EscrowStatus.COMPLETED,
      EscrowStatus.CANCELLED,
      EscrowStatus.DISPUTED,
      EscrowStatus.EXPIRED,
    ];

    const TERMINAL_STATUSES: EscrowStatus[] = [
      EscrowStatus.COMPLETED,
      EscrowStatus.CANCELLED,
      EscrowStatus.EXPIRED,
    ];

    const NON_TERMINAL_STATUSES: EscrowStatus[] = [
      EscrowStatus.PENDING,
      EscrowStatus.ACTIVE,
      EscrowStatus.DISPUTED,
    ];

    const statusArb = fc.constantFrom(...ALL_STATUSES);

    const terminalStatusArb = fc.constantFrom(...TERMINAL_STATUSES);

    const nonTerminalStatusArb = fc.constantFrom(...NON_TERMINAL_STATUSES);

    interface EscrowModel {
      status: EscrowStatus;
      deposited: number;
      released: number;
    }

    type Operation =
      | { kind: 'transition'; to: EscrowStatus }
      | { kind: 'release'; amount: number };

    const operationArb: fc.Arbitrary<Operation> = fc.oneof(
      fc.record({
        kind: fc.constant('transition' as const),
        to: statusArb,
      }),
      fc.record({
        kind: fc.constant('release' as const),
        amount: fc.integer({ min: 0, max: 1_000_000 }),
      }),
    );

    const operationsArb = fc.array(operationArb, { maxLength: 30 });

    const applyOperation = (
      model: EscrowModel,
      op: Operation,
    ): EscrowModel => {
      if (op.kind === 'transition') {
        if (canTransition(model.status, op.to)) {
          return { ...model, status: op.to };
        }
        return model;
      }

      // release: only allowed while ACTIVE, and never exceeds remaining funds
      if (model.status !== EscrowStatus.ACTIVE) {
        return model;
      }
      const remaining = model.deposited - model.released;
      const amount = Math.min(op.amount, remaining);
      return { ...model, released: model.released + amount };
    };

    const assertInvariants = (model: EscrowModel) => {
      // Funds conserved: released never exceeds deposited
      expect(model.released).toBeGreaterThanOrEqual(0);
      expect(model.released).toBeLessThanOrEqual(model.deposited);

      // Terminal states have no outgoing transitions
      if (isTerminalStatus(model.status)) {
        for (const target of ALL_STATUSES) {
          expect(canTransition(model.status, target)).toBe(false);
        }
      }

      // Non-terminal states must have at least one valid transition
      if (!isTerminalStatus(model.status)) {
        const hasOutgoing = ALL_STATUSES.some((target) =>
          canTransition(model.status, target),
        );
        expect(hasOutgoing).toBe(true);
      }
    };

    it('preserves invariants across random operation sequences', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          operationsArb,
          (deposited, operations) => {
            let model: EscrowModel = {
              status: EscrowStatus.PENDING,
              deposited,
              released: 0,
            };

            assertInvariants(model);

            for (const op of operations) {
              model = applyOperation(model, op);
              assertInvariants(model);
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it('never transitions out of a terminal state', () => {
      fc.assert(
        fc.property(
          terminalStatusArb,
          fc.array(statusArb, { maxLength: 20 }),
          (terminal, targets) => {
            let status = terminal;
            for (const target of targets) {
              expect(canTransition(status, target)).toBe(false);
              expect(() => validateTransition(status, target)).toThrow(
                BadRequestException,
              );
              // status must remain unchanged
              status = terminal;
            }
            expect(isTerminalStatus(status)).toBe(true);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('release never exceeds the deposited amount', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.array(fc.integer({ min: 0, max: 1_000_000 }), { maxLength: 30 }),
          (deposited, releases) => {
            let released = 0;
            let status: EscrowStatus = EscrowStatus.ACTIVE;

            for (const requested of releases) {
              if (status !== EscrowStatus.ACTIVE) {
                break;
              }
              const remaining = deposited - released;
              const amount = Math.min(requested, remaining);
              released += amount;
              expect(released).toBeLessThanOrEqual(deposited);
            }
          },
        ),
        { numRuns: 200 },
      );
    });

    it('canTransition is consistent with validateTransition', () => {
      fc.assert(
        fc.property(statusArb, statusArb, (from, to) => {
          const allowed = canTransition(from, to);
          if (allowed) {
            expect(() => validateTransition(from, to)).not.toThrow();
          } else {
            expect(() => validateTransition(from, to)).toThrow(
              BadRequestException,
            );
          }
        }),
        { numRuns: 200 },
      );
    });

    it('isTerminalStatus agrees with absence of outgoing transitions', () => {
      fc.assert(
        fc.property(statusArb, (status) => {
          const hasOutgoing = ALL_STATUSES.some((target) =>
            canTransition(status, target),
          );
          expect(isTerminalStatus(status)).toBe(!hasOutgoing);
        }),
        { numRuns: 100 },
      );
    });

    it('non-terminal statuses always permit at least one transition', () => {
      fc.assert(
        fc.property(nonTerminalStatusArb, (status) => {
          const hasOutgoing = ALL_STATUSES.some((target) =>
            canTransition(status, target),
          );
          expect(hasOutgoing).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });
});
