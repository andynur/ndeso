import { describe, expect, test } from 'bun:test';
import { isLocaleId, localeInfo, resolveLocale, SOURCE_LOCALE, SUPPORTED_LOCALES } from './i18n.ts';

describe('locale registry', () => {
  test('ships en and id, with en as the source locale', () => {
    expect(SUPPORTED_LOCALES.map((locale) => locale.id)).toEqual(['en', 'id']);
    expect(SOURCE_LOCALE).toBe('en');
  });

  test('ids are unique and every locale has an Intl tag and a native name', () => {
    const ids = SUPPORTED_LOCALES.map((locale) => locale.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const locale of SUPPORTED_LOCALES) {
      expect(locale.tag.length).toBeGreaterThan(0);
      expect(locale.nativeName.length).toBeGreaterThan(0);
    }
  });

  test('isLocaleId narrows only known ids', () => {
    expect(isLocaleId('id')).toBe(true);
    expect(isLocaleId('jv')).toBe(false);
  });

  test('localeInfo throws for an unknown id', () => {
    expect(() => localeInfo('jv' as never)).toThrow('Unknown locale: jv');
  });
});

describe('resolveLocale', () => {
  test('matches on the base tag', () => {
    expect(resolveLocale(['id-ID'])).toBe('id');
    expect(resolveLocale(['en-GB'])).toBe('en');
  });

  test('prefers the first supported entry', () => {
    expect(resolveLocale(['jv-ID', 'id-ID', 'en-US'])).toBe('id');
  });

  test('falls back to the source locale', () => {
    expect(resolveLocale([])).toBe('en');
    expect(resolveLocale(['su', 'ban'])).toBe('en');
  });
});
