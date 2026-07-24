"use client";

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Languages } from 'lucide-react';

const locales = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'ar', label: 'العربية' },
  { code: 'pt', label: 'Português' },
];

export function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = locale;
      document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
      localStorage.setItem('vaultix-locale', locale);
    }
  }, [locale]);

  const handleChange = (nextLocale: string) => {
    setOpen(false);
    const currentPath = pathname || '/';
    const normalizedPath = currentPath === '/' ? '/' : currentPath.replace(/^\/(en|fr|sw|ar|pt)(?=\/|$)/, '');
    const nextPath = nextLocale === 'en' ? normalizedPath : `/${nextLocale}${normalizedPath === '/' ? '' : normalizedPath}`;
    router.push(nextPath);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white/80 px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-200"
        aria-label={t('themeMenu')}
      >
        <Languages className="h-4 w-4" />
        <span className="uppercase">{locale}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
          {locales.map((option) => (
            <button
              key={option.code}
              type="button"
              onClick={() => handleChange(option.code)}
              className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm ${locale === option.code ? 'bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-white' : 'text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800'}`}
            >
              <span>{option.label}</span>
              <span className="text-xs uppercase">{option.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
