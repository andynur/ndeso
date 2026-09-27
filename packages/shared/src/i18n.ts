/**
 * Locale registry shared by the client runtime, the content package, and `check:i18n`.
 * Adding a locale: copy `packages/content/locales/en`, translate, then add an entry here
 * (I18N §5). `en` is the source locale — every key in `en` must exist in every other locale.
 */

export interface LocaleInfo {
  /** Our locale id, also the directory name under `packages/content/locales/`. */
  readonly id: string;
  /** BCP-47 tag handed to `Intl.*`. */
  readonly tag: string;
  /** Display name written in the language itself (for the settings menu). */
  readonly nativeName: string;
}

export const SUPPORTED_LOCALES = [
  { id: 'en', tag: 'en', nativeName: 'English' },
  { id: 'id', tag: 'id-ID', nativeName: 'Bahasa Indonesia' },
] as const satisfies readonly LocaleInfo[];

export type LocaleId = (typeof SUPPORTED_LOCALES)[number]['id'];

/** Source of truth for translations; `check:i18n` compares every other locale against it. */
export const SOURCE_LOCALE: LocaleId = 'en';

/** Namespaces = locale file names without the extension (I18N §2). */
export const LOCALE_NAMESPACES = [
  'ui',
  'items',
  'npcs',
  'glossary',
  'tutorial',
  'calendar',
] as const;
export type LocaleNamespace = (typeof LOCALE_NAMESPACES)[number];

export function isLocaleId(value: string): value is LocaleId {
  return SUPPORTED_LOCALES.some((locale) => locale.id === value);
}

export function localeInfo(id: LocaleId): LocaleInfo {
  const found = SUPPORTED_LOCALES.find((locale) => locale.id === id);
  if (!found) throw new Error(`Unknown locale: ${id}`);
  return found;
}

/**
 * Pick the best supported locale for a list of browser languages, falling back to `en`.
 * Pure so it can be unit-tested without a browser.
 */
export function resolveLocale(preferred: readonly string[]): LocaleId {
  for (const raw of preferred) {
    const base = raw.toLowerCase().split('-')[0];
    if (base !== undefined && isLocaleId(base)) return base;
  }
  return SOURCE_LOCALE;
}
