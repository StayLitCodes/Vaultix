export const SUPPORTED_LOCALES = ['en', 'fr', 'sw', 'ar', 'pt'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function resolveLocale(locale?: string | null): SupportedLocale {
  if (typeof locale === 'string' && SUPPORTED_LOCALES.includes(locale as SupportedLocale)) {
    return locale as SupportedLocale;
  }

  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem('vaultix-locale');
    if (stored && SUPPORTED_LOCALES.includes(stored as SupportedLocale)) {
      return stored as SupportedLocale;
    }
  }

  return 'en';
}

export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(value);
}
