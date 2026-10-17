import {
  CanonicalEscrowStatus,
  canTakeFinancialAction,
  isTerminalStatus,
  normalizeEscrowStatus,
} from './escrowStatus';

describe('normalizeEscrowStatus', () => {
  describe('backend values (source of truth, lowercase)', () => {
    it.each([
      ['pending', CanonicalEscrowStatus.CREATED],
      ['active', CanonicalEscrowStatus.ACTIVE],
      ['completed', CanonicalEscrowStatus.COMPLETED],
      ['cancelled', CanonicalEscrowStatus.CANCELLED],
      ['disputed', CanonicalEscrowStatus.DISPUTED],
      ['expired', CanonicalEscrowStatus.EXPIRED],
      ['refunded', CanonicalEscrowStatus.REFUNDED],
    ])('maps %s to %s', (raw, expected) => {
      expect(normalizeEscrowStatus(raw)).toBe(expected);
    });
  });

  describe('legacy aliases and casing variants', () => {
    it.each([
      ['created', CanonicalEscrowStatus.CREATED],
      ['PENDING', CanonicalEscrowStatus.CREATED],
      ['Pending', CanonicalEscrowStatus.CREATED],
      ['funded', CanonicalEscrowStatus.FUNDED],
      ['FUNDED', CanonicalEscrowStatus.FUNDED],
      ['ACTIVE', CanonicalEscrowStatus.ACTIVE],
      ['Active', CanonicalEscrowStatus.ACTIVE],
      ['resolved', CanonicalEscrowStatus.RESOLVED],
      ['RESOLVED', CanonicalEscrowStatus.RESOLVED],
      ['released', CanonicalEscrowStatus.COMPLETED],
      ['RELEASED', CanonicalEscrowStatus.COMPLETED],
      ['canceled', CanonicalEscrowStatus.CANCELLED],
      ['CANCELLED', CanonicalEscrowStatus.CANCELLED],
      ['CANCELED', CanonicalEscrowStatus.CANCELLED],
      ['EXPIRED', CanonicalEscrowStatus.EXPIRED],
      ['Expired', CanonicalEscrowStatus.EXPIRED],
      ['refunded', CanonicalEscrowStatus.REFUNDED],
    ])('maps %s to %s', (raw, expected) => {
      expect(normalizeEscrowStatus(raw)).toBe(expected);
    });

    it('tolerates surrounding whitespace', () => {
      expect(normalizeEscrowStatus('  active  ')).toBe(
        CanonicalEscrowStatus.ACTIVE,
      );
    });
  });

  describe('unfamiliar future values', () => {
    it.each(['in_arbitration', 'liquidating', 'escrowed_v2', 'mystery'])(
      'maps %s to UNKNOWN',
      (raw) => {
        expect(normalizeEscrowStatus(raw)).toBe(
          CanonicalEscrowStatus.UNKNOWN,
        );
      },
    );

    it('maps empty and non-string input to UNKNOWN', () => {
      expect(normalizeEscrowStatus('')).toBe(CanonicalEscrowStatus.UNKNOWN);
      expect(normalizeEscrowStatus('   ')).toBe(CanonicalEscrowStatus.UNKNOWN);
      expect(
        normalizeEscrowStatus(undefined as unknown as string),
      ).toBe(CanonicalEscrowStatus.UNKNOWN);
      expect(
        normalizeEscrowStatus(null as unknown as string),
      ).toBe(CanonicalEscrowStatus.UNKNOWN);
      expect(
        normalizeEscrowStatus(7 as unknown as string),
      ).toBe(CanonicalEscrowStatus.UNKNOWN);
    });

    it('never returns null for any input', () => {
      const inputs = ['', 'active', '???', 'null', 'undefined'];
      for (const input of inputs) {
        expect(normalizeEscrowStatus(input)).not.toBeNull();
        expect(normalizeEscrowStatus(input)).not.toBeUndefined();
      }
    });
  });
});

describe('isTerminalStatus', () => {
  it.each([
    CanonicalEscrowStatus.COMPLETED,
    CanonicalEscrowStatus.CANCELLED,
    CanonicalEscrowStatus.REFUNDED,
    CanonicalEscrowStatus.RESOLVED,
    CanonicalEscrowStatus.EXPIRED,
  ])('%s is terminal', (status) => {
    expect(isTerminalStatus(status)).toBe(true);
  });

  it.each([
    CanonicalEscrowStatus.CREATED,
    CanonicalEscrowStatus.FUNDED,
    CanonicalEscrowStatus.ACTIVE,
    CanonicalEscrowStatus.DISPUTED,
    CanonicalEscrowStatus.UNKNOWN,
  ])('%s is not terminal', (status) => {
    expect(isTerminalStatus(status)).toBe(false);
  });
});

describe('canTakeFinancialAction', () => {
  it.each([
    CanonicalEscrowStatus.CREATED,
    CanonicalEscrowStatus.FUNDED,
    CanonicalEscrowStatus.ACTIVE,
    CanonicalEscrowStatus.DISPUTED,
  ])('%s allows financial actions', (status) => {
    expect(canTakeFinancialAction(status)).toBe(true);
  });

  it('does not allow financial actions for terminal states', () => {
    for (const status of [
      CanonicalEscrowStatus.COMPLETED,
      CanonicalEscrowStatus.CANCELLED,
      CanonicalEscrowStatus.REFUNDED,
      CanonicalEscrowStatus.RESOLVED,
      CanonicalEscrowStatus.EXPIRED,
    ]) {
      expect(canTakeFinancialAction(status)).toBe(false);
    }
  });

  it('does not allow financial actions for UNKNOWN', () => {
    expect(canTakeFinancialAction(CanonicalEscrowStatus.UNKNOWN)).toBe(false);
  });
});
