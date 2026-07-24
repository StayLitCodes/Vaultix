import { getTranslations as nextGetTranslations } from 'next-intl/server';

export async function getTranslations(locale: string) {
  const messages = (await import(`@/i18n/messages/${locale}.json`)).default;

  return {
    nav: messages.nav,
    home: messages.home,
    dashboard: messages.dashboard,
    escrow: messages.escrow,
    transactions: messages.transactions,
    common: messages.common,
  };
}

export async function getServerTranslations(locale: string) {
  return nextGetTranslations({ locale, namespace: 'common' });
}
