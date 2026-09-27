import { describe, expect, test } from 'bun:test';
import type { LocaleId } from '@ndeso/shared';
import {
  type BundleRegistry,
  createI18n,
  LOCALE_STORAGE_KEY,
  type SettingsStore,
} from './runtime.ts';

/** `en` is complete; `id` is deliberately missing `only.en` so the fallback is exercised. */
const BUNDLES = {
  en: {
    ui: async () => ({ default: { 'boot.hello': 'Hello', 'only.en': 'Source only' } }),
    glossary: async () => ({ default: { 'pasaran.term': 'Pasaran' } }),
  },
  id: {
    ui: async () => ({ default: { 'boot.hello': 'Halo' } }),
    glossary: async () => ({ default: { 'pasaran.term': 'Pasaran (ID)' } }),
  },
} satisfies BundleRegistry;

function memoryStore(initial: Record<string, string> = {}): SettingsStore & {
  readonly data: Record<string, string>;
} {
  const data = { ...initial };
  return {
    data,
    read: (key) => data[key] ?? null,
    write: (key, value) => {
      data[key] = value;
    },
  };
}

/** A store that throws on every access, like `localStorage` in a locked-down browser. */
const hostileStore: SettingsStore = {
  read() {
    throw new Error('SecurityError');
  },
  write() {
    throw new Error('SecurityError');
  },
};

function makeI18n(storage: SettingsStore = memoryStore(), dev = true) {
  return createI18n({ bundles: BUNDLES, storage, dev });
}

describe('init', () => {
  test('picks the best match among the browser languages', async () => {
    const i18n = makeI18n();
    expect(await i18n.init(['id-ID', 'en-US'])).toBe('id');
    expect(i18n.locale.value).toBe('id');
    expect(i18n.t('boot.hello')).toBe('Halo');
  });

  test('falls back to the source locale for an unsupported language', async () => {
    const i18n = makeI18n();
    expect(await i18n.init(['jv-ID'])).toBe('en');
    expect(i18n.t('boot.hello')).toBe('Hello');
  });

  test('a saved setting wins over the browser languages', async () => {
    const i18n = makeI18n(memoryStore({ [LOCALE_STORAGE_KEY]: 'id' }));
    expect(await i18n.init(['en-US'])).toBe('id');
  });

  test('a saved value that is not a known locale is ignored', async () => {
    const i18n = makeI18n(memoryStore({ [LOCALE_STORAGE_KEY]: 'kl' }));
    expect(await i18n.init(['en-US'])).toBe('en');
  });

  test('storage that throws on read does not break boot', async () => {
    const i18n = makeI18n(hostileStore);
    expect(await i18n.init(['id-ID'])).toBe('id');
  });
});

describe('t — fallback chain (I18N §4)', () => {
  test('a key missing from the active locale falls back to the source locale', async () => {
    const i18n = makeI18n();
    await i18n.init(['id-ID']);
    expect(i18n.t('only.en')).toBe('Source only');
  });

  test('a key missing everywhere shows ⟦key⟧ in dev', async () => {
    const i18n = makeI18n();
    await i18n.init(['id-ID']);
    expect(i18n.t('nope.nope')).toBe('⟦nope.nope⟧');
  });

  test('a key missing everywhere degrades to the bare key in production', async () => {
    const i18n = createI18n({ bundles: BUNDLES, storage: memoryStore(), dev: false });
    await i18n.init(['id-ID']);
    expect(i18n.t('nope.nope')).toBe('nope.nope');
  });

  test('onMissingKey reports the key and the active locale', async () => {
    const seen: [string, LocaleId][] = [];
    const i18n = createI18n({
      bundles: BUNDLES,
      storage: memoryStore(),
      dev: true,
      onMissingKey: (key, locale) => seen.push([key, locale]),
    });
    await i18n.init(['id-ID']);
    i18n.t('nope.nope');
    expect(seen).toEqual([['nope.nope', 'id']]);
  });

  test('placeholders are substituted through the message formatter', async () => {
    const i18n = createI18n({
      bundles: {
        en: { ui: async () => ({ default: { 'hud.day': '{season} day {day}' } }) },
        id: { ui: async () => ({ default: { 'hud.day': '{season} hari ke-{day}' } }) },
      },
      storage: memoryStore(),
      dev: true,
    });
    await i18n.init(['id-ID']);
    expect(i18n.t('hud.day', { season: 'Musim Hujan', day: 3 })).toBe('Musim Hujan hari ke-3');
  });
});

describe('loadNamespace', () => {
  test('a namespace is unavailable until it is loaded, then resolves', async () => {
    const i18n = makeI18n();
    await i18n.init(['id-ID']);
    expect(i18n.t('glossary:pasaran.term')).toBe('⟦glossary:pasaran.term⟧');
    await i18n.loadNamespace('glossary');
    expect(i18n.t('glossary:pasaran.term')).toBe('Pasaran (ID)');
  });

  test('an unknown namespace is a no-op rather than a crash', async () => {
    const i18n = makeI18n();
    await i18n.init(['en-US']);
    await i18n.loadNamespace('npcs');
    expect(i18n.t('npcs:whoever.name')).toBe('⟦npcs:whoever.name⟧');
  });
});

describe('setLocale', () => {
  test('switches every string and persists the choice', async () => {
    const storage = memoryStore();
    const i18n = makeI18n(storage);
    await i18n.init(['en-US']);
    await i18n.setLocale('id');
    expect(i18n.locale.value).toBe('id');
    expect(i18n.t('boot.hello')).toBe('Halo');
    expect(storage.data[LOCALE_STORAGE_KEY]).toBe('id');
  });

  test('reloads the namespaces already in use, not just ui', async () => {
    const i18n = makeI18n();
    await i18n.init(['en-US']);
    await i18n.loadNamespace('glossary');
    expect(i18n.t('glossary:pasaran.term')).toBe('Pasaran');
    await i18n.setLocale('id');
    expect(i18n.t('glossary:pasaran.term')).toBe('Pasaran (ID)');
  });

  test('switching to the active locale is a no-op', async () => {
    const storage = memoryStore();
    const i18n = makeI18n(storage);
    await i18n.init(['id-ID']);
    await i18n.setLocale('id');
    expect(storage.data[LOCALE_STORAGE_KEY]).toBeUndefined();
  });

  test('storage that throws on write still completes the switch', async () => {
    const i18n = makeI18n(hostileStore);
    await i18n.init(['en-US']);
    await i18n.setLocale('id');
    expect(i18n.t('boot.hello')).toBe('Halo');
  });
});

describe('format signal', () => {
  test('number formatting follows the active locale', async () => {
    const i18n = makeI18n();
    await i18n.init(['en-US']);
    expect(i18n.format.value.money(12500)).toBe('Rp12,500');
    await i18n.setLocale('id');
    expect(i18n.format.value.money(12500)).toBe('Rp12.500');
  });
});
