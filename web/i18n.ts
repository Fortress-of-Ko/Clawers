import { getRequestConfig } from 'next-intl/server';
import enMessages from './messages/en.json';

export const locales = ['ko', 'en', 'ja', 'zh'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ko';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeMessages(
  base: Record<string, unknown>,
  override: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = merged[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      merged[key] = mergeMessages(baseValue, value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !locales.includes(locale as Locale)) {
    locale = defaultLocale;
  }
  const localeMessages = (await import(`./messages/${locale}.json`)).default as Record<string, unknown>;
  const messages = locale === 'en'
    ? localeMessages
    : mergeMessages(enMessages as Record<string, unknown>, localeMessages);
  return { locale, messages, timeZone: 'Asia/Seoul' };
});
