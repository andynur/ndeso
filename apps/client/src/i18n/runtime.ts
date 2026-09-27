/**
 * i18n runtime (I18N §4), as a factory over injected bundles and settings storage.
 *
 * Nothing here touches the DOM or the generated locale registry: `index.ts` wires the
 * real ones up. That keeps the fallback chain, the hot switch and the storage handling
 * unit-testable, which is the part of M0-04 worth testing.
 */

import {
  formatMessage,
  isLocaleId,
  type LocaleId,
  type MessageValues,
  resolveLocale,
  SOURCE_LOCALE,
} from '@ndeso/shared';
import { computed, type ReadonlySignal, signal } from '@preact/signals';
import { createNumberFormats, type NumberFormats } from './format.ts';
import { DEFAULT_NAMESPACE, splitKey } from './keys.ts';

export type Bundle = Readonly<Record<string, string>>;
export type BundleLoader = () => Promise<{ readonly default: Bundle }>;
export type BundleRegistry = Readonly<Record<LocaleId, Readonly<Record<string, BundleLoader>>>>;

/** The slice of settings persistence the runtime needs; see ARCHITECTURE §4.4. */
export interface SettingsStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
}

export interface I18nOptions {
  readonly bundles: BundleRegistry;
  readonly storage: SettingsStore;
  /** Dev builds surface a missing key as `⟦key⟧`; production falls back to the key. */
  readonly dev: boolean;
  readonly onMissingKey?: ((key: string, locale: LocaleId) => void) | undefined;
}

/** `K` is the typed key union; `index.ts` binds it to the generated `I18nKey`. */
export interface I18n<K extends string = string> {
  readonly locale: ReadonlySignal<LocaleId>;
  readonly format: ReadonlySignal<NumberFormats>;
  t(key: K, values?: MessageValues): string;
  /** Resolves saved setting → browser languages → source locale, and loads `ui`. */
  init(preferred: readonly string[]): Promise<LocaleId>;
  setLocale(next: LocaleId): Promise<void>;
  loadNamespace(namespace: string): Promise<void>;
}

export const LOCALE_STORAGE_KEY = 'ndeso.locale';

export function createI18n<K extends string = string>(options: I18nOptions): I18n<K> {
  const { bundles, storage, dev, onMissingKey } = options;

  /** Cache key is `<locale>:<namespace>`; a bundle is immutable once loaded. */
  const loaded = new Map<string, Bundle>();
  /** Namespaces the game has asked for, so a locale switch reloads exactly those. */
  const requested = new Set<string>([DEFAULT_NAMESPACE]);

  const localeSignal = signal<LocaleId>(SOURCE_LOCALE);
  /** Bumped when a bundle lands, so `t()` re-runs for components already rendered. */
  const revision = signal(0);

  async function load(target: LocaleId, namespace: string): Promise<void> {
    const cacheKey = `${target}:${namespace}`;
    if (loaded.has(cacheKey)) return;
    const loader = bundles[target]?.[namespace];
    if (loader === undefined) return;
    loaded.set(cacheKey, (await loader()).default);
  }

  /** The active locale plus the fallback, deduplicated when they are the same. */
  function localesToLoad(active: LocaleId): LocaleId[] {
    return [...new Set<LocaleId>([active, SOURCE_LOCALE])];
  }

  function readStored(): LocaleId | undefined {
    try {
      const stored = storage.read(LOCALE_STORAGE_KEY);
      return stored !== null && isLocaleId(stored) ? stored : undefined;
    } catch {
      // Private mode or blocked storage: fall through to the browser languages.
      return undefined;
    }
  }

  function lookup(target: LocaleId, namespace: string, id: string): string | undefined {
    return loaded.get(`${target}:${namespace}`)?.[id];
  }

  return {
    locale: computed(() => localeSignal.value),
    format: computed(() => createNumberFormats(localeSignal.value)),

    async init(preferred) {
      const chosen = readStored() ?? resolveLocale(preferred);
      localeSignal.value = chosen;
      await Promise.all(localesToLoad(chosen).map((target) => load(target, DEFAULT_NAMESPACE)));
      revision.value++;
      return chosen;
    },

    async loadNamespace(namespace) {
      requested.add(namespace);
      await Promise.all(
        localesToLoad(localeSignal.peek()).map((target) => load(target, namespace)),
      );
      revision.value++;
    },

    async setLocale(next) {
      if (next === localeSignal.peek()) return;
      await Promise.all([...requested].map((namespace) => load(next, namespace)));
      try {
        storage.write(LOCALE_STORAGE_KEY, next);
      } catch {
        // Not remembering the choice is not worth failing the switch over.
      }
      localeSignal.value = next;
    },

    t(key, values) {
      // Reading both signals is what subscribes a Preact component to locale changes.
      const active = localeSignal.value;
      revision.value;

      const { namespace, id } = splitKey(key);
      const pattern = lookup(active, namespace, id) ?? lookup(SOURCE_LOCALE, namespace, id);

      if (pattern === undefined) {
        onMissingKey?.(key, active);
        return dev ? `⟦${key}⟧` : key;
      }
      return formatMessage(active, pattern, values);
    },
  };
}
