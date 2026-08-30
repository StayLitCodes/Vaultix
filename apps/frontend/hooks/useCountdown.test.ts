import { calculateCountdown } from './useCountdown';

describe('calculateCountdown', () => {
  it('should calculate correct countdown for more than 48 hours (green urgency)', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    const target = new Date('2024-01-04T00:00:00Z');
    const result = calculateCountdown(target, now);
    expect(result.days).toBe(3);
    expect(result.hours).toBe(0);
    expect(result.minutes).toBe(0);
    expect(result.seconds).toBe(0);
    expect(result.urgency).toBe('green');
    expect(result.isExpired).toBe(false);
  });

  it('should calculate correct countdown for between 24 and 48 hours (yellow urgency)', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    const target = new Date('2024-01-02T12:00:00Z');
    const result = calculateCountdown(target, now);
    expect(result.days).toBe(1);
    expect(result.hours).toBe(12);
    expect(result.urgency).toBe('yellow');
    expect(result.isExpired).toBe(false);
  });

  it('should calculate correct countdown for less than 24 hours (red urgency)', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    const target = new Date('2024-01-01T12:00:00Z');
    const result = calculateCountdown(target, now);
    expect(result.days).toBe(0);
    expect(result.hours).toBe(12);
    expect(result.urgency).toBe('red');
    expect(result.isExpired).toBe(false);
  });

  it('should return expired state when deadline is past', () => {
    const now = new Date('2024-01-02T00:00:00Z');
    const target = new Date('2024-01-01T00:00:00Z');
    const result = calculateCountdown(target, now);
    expect(result.urgency).toBe('expired');
    expect(result.isExpired).toBe(true);
  });

  it('should handle exact hours, minutes, seconds correctly', () => {
    const now = new Date('2024-01-01T00:00:00Z');
    const target = new Date('2024-01-02T03:04:05Z');
    const result = calculateCountdown(target, now);
    expect(result.days).toBe(1);
    expect(result.hours).toBe(3);
    expect(result.minutes).toBe(4);
    expect(result.seconds).toBe(5);
  });
});
