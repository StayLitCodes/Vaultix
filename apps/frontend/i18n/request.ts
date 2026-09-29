import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "@/lib/i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const routeLocale = await requestLocale;
  const locale = isLocale(cookieLocale)
    ? cookieLocale
    : isLocale(routeLocale)
      ? routeLocale
      : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
    timeZone: "UTC",
  };
});