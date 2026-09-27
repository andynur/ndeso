import { describe, expect, test } from 'bun:test';
import { SOURCE_LOCALE, SUPPORTED_LOCALES } from '@bale/shared';
import { loadLocaleBundle, localeFile } from './index.ts';

/**
 * Smoke test for the locale seed files. The full parity checker (placeholders, Ink
 * structure, all namespaces) arrives with M0-04 as `bun run check:i18n`.
 */
const SEEDED_NAMESPACES = ['ui', 'glossary'] as const;

describe('locale seeds', () => {
  for (const { id } of SUPPORTED_LOCALES) {
    for (const namespace of SEEDED_NAMESPACES) {
      test(`${id}/${namespace}.json parses into flat string values`, async () => {
        expect(await Bun.file(localeFile(id, namespace)).exists()).toBe(true);
        const bundle = await loadLocaleBundle(id, namespace);
        expect(Object.keys(bundle).length).toBeGreaterThan(0);
        for (const [key, value] of Object.entries(bundle)) {
          expect(typeof value, `${id}/${namespace}: ${key}`).toBe('string');
        }
      });
    }
  }

  for (const namespace of SEEDED_NAMESPACES) {
    test(`${namespace}.json has the same keys in every locale`, async () => {
      const source = Object.keys(await loadLocaleBundle(SOURCE_LOCALE, namespace)).sort();
      for (const { id } of SUPPORTED_LOCALES) {
        if (id === SOURCE_LOCALE) continue;
        const keys = Object.keys(await loadLocaleBundle(id, namespace)).sort();
        expect(keys, `${id}/${namespace}`).toEqual(source);
      }
    });
  }
});
