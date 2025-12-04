import { getRequestConfig } from 'next-intl/server';
import { locales, type Locale } from '../i18n';

export default getRequestConfig(async ({ requestLocale }) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Default to Japanese for pages without locale prefix (e.g., policy pages)
  if (!locale || !locales.includes(locale as Locale)) {
    locale = 'ja';
  }

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default
  };
});
