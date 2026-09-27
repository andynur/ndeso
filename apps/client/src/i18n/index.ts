/**
 * The game's i18n instance: the runtime from `runtime.ts` wired to the generated
 * locale registry and to `localStorage`. Import `t` from here, never `createI18n`.
 */

import type { I18nKey } from '@ndeso/content/i18n';
import { LOCALE_BUNDLES } from '@ndeso/content/i18n';
import { DEV } from '../platform/env.ts';
import { localSettings } from '../platform/settings.ts';
import { createI18n } from './runtime.ts';

export type { NumberFormats } from './format.ts';
export { createNumberFormats } from './format.ts';
export type { BundleRegistry, I18n, SettingsStore } from './runtime.ts';
export { createI18n, LOCALE_STORAGE_KEY } from './runtime.ts';

const i18n = createI18n<I18nKey>({
  bundles: LOCALE_BUNDLES,
  storage: localSettings,
  dev: DEV,
  onMissingKey: DEV
    ? (key, locale) => {
        // biome-ignore lint/suspicious/noConsole: I18N §4 requires a dev warning for a missing key.
        console.warn(`[i18n] missing key ${key} (locale ${locale})`);
      }
    : undefined,
});

export const { locale, format, t, setLocale, loadNamespace } = i18n;
export const initI18n = i18n.init;

/**
 * Domain literals for the date line. M1-01 owns the real clock and moves these into
 * `packages/shared`; they are here so the formatter can be typed before that lands.
 */
export type Season = 'hujan' | 'kemarau';
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type Pasaran = 'legi' | 'pahing' | 'pon' | 'wage' | 'kliwon';

export interface GameDate {
  readonly day: number;
  readonly season: Season;
  readonly weekday: Weekday;
  readonly pasaran: Pasaran;
}

/**
 * The HUD date line (I18N §4). Word order differs per locale, so the whole sentence
 * is one `hud.day` message with placeholders rather than concatenated fragments.
 */
export function formatGameDate(date: GameDate): string {
  return t('hud.day', {
    weekday: t(`weekday.${date.weekday}`),
    pasaran: t(`pasaran.${date.pasaran}`),
    season: t(`season.${date.season}`),
    day: date.day,
  });
}
