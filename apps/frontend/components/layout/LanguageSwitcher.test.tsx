import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import LanguageSwitcher from './LanguageSwitcher';
import en from '@/messages/en.json';

const refresh = jest.fn();

jest.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key === 'language' ? 'Language' : key,
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

describe('LanguageSwitcher', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.cookie = 'vaultix-locale=; Path=/; Max-Age=0';
    document.documentElement.lang = 'en';
    document.documentElement.dir = 'ltr';
    refresh.mockClear();
  });

  it('persists a selected language and updates document direction', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <LanguageSwitcher />
      </NextIntlClientProvider>,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'ar' },
    });

    expect(window.localStorage.getItem('vaultix-locale')).toBe('ar');
    expect(document.cookie).toContain('vaultix-locale=ar');
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('returns the document to LTR when switching back to French', () => {
    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <LanguageSwitcher />
      </NextIntlClientProvider>,
    );

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), {
      target: { value: 'fr' },
    });

    expect(document.documentElement).toHaveAttribute('lang', 'fr');
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it('restores a saved localStorage locale when the server locale is stale', () => {
    window.localStorage.setItem('vaultix-locale', 'ar');

    render(
      <NextIntlClientProvider locale="en" messages={en}>
        <LanguageSwitcher />
      </NextIntlClientProvider>,
    );

    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});