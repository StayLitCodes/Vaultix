import { formatDate, formatNumber, resolveLocale } from './locale';

describe('locale helpers', () => {
  it('formats numbers with locale-aware separators', () => {
    expect(formatNumber(1250000, 'fr-FR')).toContain('1');
    expect(formatNumber(1250000, 'fr-FR')).toContain('250');
    expect(formatNumber(1250000, 'en-US')).toContain('1,250,000');
  });

  it('formats dates according to the selected locale', () => {
    const value = new Date('2025-01-15T12:00:00.000Z');
    expect(formatDate(value, 'en-US')).toContain('1/15/2025');
    expect(formatDate(value, 'fr-FR')).toContain('15/01/2025');
  });

  it('resolves an Arabic locale from storage and defaults safely', () => {
    const storedLocale = resolveLocale('ar');
    expect(storedLocale).toBe('ar');
    expect(resolveLocale('xx' as string)).toBe('en');
    expect(resolveLocale(undefined)).toBe('en');
  });
});
