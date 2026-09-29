import en from '../messages/en.json';
import fr from '../messages/fr.json';
import sw from '../messages/sw.json';
import ar from '../messages/ar.json';
import pt from '../messages/pt.json';
import {
  formatLocaleDate,
  formatLocaleNumber,
  formatRelativeTime,
  isLocale,
  isRtlLocale,
  LOCALE_COOKIE,
  LOCALE_STORAGE_KEY,
  persistLocalePreference,
} from './i18n';

const catalogs = { en, fr, sw, ar, pt };

function leafPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return [prefix];

  return Object.entries(value).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

describe('locale utilities', () => {
  it.each(['en', 'fr', 'sw', 'ar', 'pt'])('accepts supported locale %s', (locale) => {
    expect(isLocale(locale)).toBe(true);
  });

  it('rejects unsupported locale values', () => {
    expect(isLocale('de')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });

  it('enables RTL only for Arabic', () => {
    expect(isRtlLocale('ar')).toBe(true);
    expect(isRtlLocale('fr')).toBe(false);
  });

  it('formats dates and numbers using the requested locale', () => {
    expect(formatLocaleDate(new Date('2024-01-02T12:00:00Z'), 'fr', { dateStyle: 'short' })).toBe('02/01/2024');
    expect(formatLocaleNumber(1234.5, 'fr')).toBe('1\u202f234,5');
  });

  it('formats relative event times in the requested locale', () => {
    const now = new Date('2024-01-02T12:00:00Z');
    const twoMinutesAgo = new Date('2024-01-02T11:58:00Z');

    expect(formatRelativeTime(twoMinutesAgo, 'en', now)).toBe('2 minutes ago');
    expect(formatRelativeTime(twoMinutesAgo, 'fr', now)).toContain('2');
  });

  it('persists locale in localStorage and a server-readable cookie', () => {
    persistLocalePreference('fr');

    expect(window.localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('fr');
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=fr`);
  });

  it('keeps all locale catalogs structurally complete', () => {
    const englishPaths = leafPaths(en).sort();

    Object.entries(catalogs).forEach(([locale, catalog]) => {
      expect(leafPaths(catalog).sort()).toEqual(englishPaths);
      expect(locale).toBeTruthy();
    });
  });
});