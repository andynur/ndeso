import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LocaleId, LocaleNamespace } from '@bale/shared';

export * from './calendar.ts';

/** Absolute path of this package, so tools and tests can find data without cwd guessing. */
export const CONTENT_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

export const LOCALES_DIR = join(CONTENT_ROOT, 'locales');

/** Path of one locale file, e.g. `localeFile('id', 'ui')`. May not exist yet during M0. */
export function localeFile(locale: LocaleId, namespace: LocaleNamespace): string {
  return join(LOCALES_DIR, locale, `${namespace}.json`);
}

/** A namespace file: flat dotted keys → message strings (I18N §2). */
export type LocaleBundle = Record<string, string>;

export async function loadLocaleBundle(
  locale: LocaleId,
  namespace: LocaleNamespace,
): Promise<LocaleBundle> {
  const file = Bun.file(localeFile(locale, namespace));
  return (await file.json()) as LocaleBundle;
}
