"use client";

import { useRouter } from "next/navigation";
import { useEffect } from 'react';
import { useLocale, useTranslations } from "next-intl";
import {
  LOCALE_LABELS,
  LOCALES,
  LOCALE_STORAGE_KEY,
  type Locale,
  isLocale,
  isRtlLocale,
  persistLocalePreference,
} from "@/lib/i18n";

export default function LanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const t = useTranslations("navigation");

  useEffect(() => {
    const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!isLocale(storedLocale) || storedLocale === locale) return;

    persistLocalePreference(storedLocale);
    document.documentElement.lang = storedLocale;
    document.documentElement.dir = isRtlLocale(storedLocale) ? "rtl" : "ltr";
    router.refresh();
  }, [locale, router]);

  const handleChange = (nextLocale: Locale) => {
    persistLocalePreference(nextLocale);
    document.documentElement.lang = nextLocale;
    document.documentElement.dir = isRtlLocale(nextLocale) ? "rtl" : "ltr";
    router.refresh();
  };

  return (
    <label className="flex min-h-[44px] items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
      <span className="sr-only">{t("language")}</span>
      <select
        aria-label={t("language")}
        value={locale}
        onChange={(event) => handleChange(event.target.value as Locale)}
        className="min-h-[40px] max-w-32 rounded-md border border-gray-300 bg-white px-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
      >
        {LOCALES.map((supportedLocale) => (
          <option key={supportedLocale} value={supportedLocale}>
            {LOCALE_LABELS[supportedLocale]}
          </option>
        ))}
      </select>
    </label>
  );
}