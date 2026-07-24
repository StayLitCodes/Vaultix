import { getRequestConfig } from 'next-intl/server';
import { routing } from '@/i18n/routing';

export default getRequestConfig(async ({ locale }) => {
  const safeLocale = locale || routing.defaultLocale;

  return {
    locale: safeLocale,
    messages: (await import(`@/i18n/messages/${safeLocale}.json`)).default,
  };
});
