/**
 * Minimal boot-time translator: enough to render the first frame in the player's
 * language. The real runtime (plurals, `format.money`, lazy namespaces, live locale
 * switching) lands in M0-04 — this is deliberately ~20 lines and bundled eagerly so
 * nothing on the critical path waits on a fetch.
 */

import en from '@ndeso/content/locales/en/ui.json';
import id from '@ndeso/content/locales/id/ui.json';
import { type LocaleId, resolveLocale, SOURCE_LOCALE } from '@ndeso/shared';

type Bundle = Readonly<Record<string, string>>;

const BUNDLES: Readonly<Record<LocaleId, Bundle>> = { en, id };

export interface BootI18n {
  readonly locale: LocaleId;
  /** Falls back to the source locale, then to the key itself so nothing renders blank. */
  t(key: string): string;
}

export function createBootI18n(preferred: readonly string[]): BootI18n {
  const locale = resolveLocale(preferred);
  const bundle = BUNDLES[locale];
  const fallback = BUNDLES[SOURCE_LOCALE];
  return {
    locale,
    t: (key) => bundle[key] ?? fallback[key] ?? key,
  };
}
