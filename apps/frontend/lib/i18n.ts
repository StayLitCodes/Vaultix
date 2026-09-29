export const LOCALES = ["en", "fr", "sw", "ar", "pt"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "vaultix-locale";
export const LOCALE_STORAGE_KEY = "vaultix-locale";

export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  sw: "Kiswahili",
  ar: "العربية",
  pt: "Português",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.some((locale) => locale === value);
}

export function isRtlLocale(locale: string): boolean {
  return locale === "ar";
}

export function formatLocaleDate(
  date: Date | number,
  locale: Locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

export function formatLocaleNumber(
  value: number,
  locale: Locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatRelativeTime(
  date: Date,
  locale: Locale,
  now = new Date(),
): string {
  const difference = (date.getTime() - now.getTime()) / 1000;
  const absoluteSeconds = Math.abs(difference);
  const relativeTime = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_536_000],
    ['month', 2_592_000],
    ['week', 604_800],
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ];
  const [unit, secondsPerUnit] = units.find(([, seconds]) => absoluteSeconds >= seconds) ?? ['second', 1];

  return relativeTime.format(Math.round(difference / secondsPerUnit), unit);
}

export function persistLocalePreference(locale: Locale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}