/**
 * i18n runtime (I18N §4). Namespaces load lazily from the generated registry, the
 * active locale lives in a signal so switching it re-renders the Preact overlay, and
 * every lookup falls back to the source locale before it falls back to the key.
 */

import type { GeneratedNamespace, I18nKey } from '@ndeso/content/i18n';
import { LOCALE_BUNDLES } from '@ndeso/content/i18n';
import {
  formatMessage,
  isLocaleId,
  type LocaleId,
  type MessageValues,
  resolveLocale,
  SOURCE_LOCALE,
} from '@ndeso/shared';
import { computed, type ReadonlySignal, signal } from '@preact/signals';
import { DEV } from '../platform/env.ts';
import { createNumberFormats, type NumberFormats } from './format.ts';
import { DEFAULT_NAMESPACE, splitKey } from './keys.ts';

const STORAGE_KEY = 'ndeso.locale';

type Bundle = Readonly<Record<string, string>>;

/** Cache key is `<locale>:<namespace>`; a bundle is immutable once loaded. */
const bundles = new Map<string, Bundle>();
/** Namespaces the game has asked for, so a locale switch can reload exactly those. */
const requested = new Set<GeneratedNamespace>([DEFAULT_NAMESPACE]);

const localeSignal = signal<LocaleId>(SOURCE_LOCALE);
/** Bumped whenever a bundle lands, so `t()` re-runs for components that already rendered. */
const revision = signal(0);

export const locale: ReadonlySignal<LocaleId> = computed(() => localeSignal.value);
export const format: ReadonlySignal<NumberFormats> = computed(() =>
  createNumberFormats(localeSignal.value),
);

async function load(target: LocaleId, namespace: GeneratedNamespace): Promise<void> {
  const cacheKey = `${target}:${namespace}`;
  if (bundles.has(cacheKey)) return;
  const module = await LOCALE_BUNDLES[target][namespace]();
  bundles.set(cacheKey, module.default);
}

/** Pull in a namespace beyond `ui` (items, npcs, …) before the screen that needs it. */
export async function loadNamespace(namespace: GeneratedNamespace): Promise<void> {
  requested.add(namespace);
  await Promise.all([localeSignal.peek(), SOURCE_LOCALE].map((target) => load(target, namespace)));
  revision.value++;
}

function readStoredLocale(): LocaleId | undefined {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null && isLocaleId(stored) ? stored : undefined;
  } catch {
    // Private mode or blocked storage: fall through to the browser languages.
    return undefined;
  }
}

function storeLocale(value: LocaleId): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Not being able to remember the choice is not worth failing a locale switch over.
  }
}

/**
 * I18N §4: saved setting → best match among the browser languages → source locale.
 * Loads `ui` for the chosen locale and for the fallback before the first render.
 */
export async function initI18n(preferred: readonly string[]): Promise<LocaleId> {
  const chosen = readStoredLocale() ?? resolveLocale(preferred);
  localeSignal.value = chosen;
  await Promise.all([load(chosen, DEFAULT_NAMESPACE), load(SOURCE_LOCALE, DEFAULT_NAMESPACE)]);
  revision.value++;
  return chosen;
}

/** Hot switch: loads every namespace already in use, then flips the signal in one go. */
export async function setLocale(next: LocaleId): Promise<void> {
  if (next === localeSignal.peek()) return;
  await Promise.all([...requested].map((namespace) => load(next, namespace)));
  storeLocale(next);
  localeSignal.value = next;
}

function lookup(target: LocaleId, namespace: GeneratedNamespace, id: string): string | undefined {
  return bundles.get(`${target}:${namespace}`)?.[id];
}

export function t(key: I18nKey, values?: MessageValues): string {
  // Reading both signals here is what subscribes a Preact component to locale changes.
  const active = localeSignal.value;
  revision.value;

  const { namespace, id } = splitKey(key);
  const pattern = lookup(active, namespace, id) ?? lookup(SOURCE_LOCALE, namespace, id);

  if (pattern === undefined) {
    if (DEV) {
      // biome-ignore lint/suspicious/noConsole: I18N §4 requires a dev warning for a missing key.
      console.warn(`[i18n] missing key ${key} (locale ${active})`);
      return `⟦${key}⟧`;
    }
    return key;
  }

  return formatMessage(active, pattern, values);
}

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
