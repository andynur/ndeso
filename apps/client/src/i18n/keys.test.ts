import { describe, expect, test } from 'bun:test';
import { DEFAULT_NAMESPACE, isNamespace, splitKey } from './keys.ts';

describe('splitKey', () => {
  test('a bare key belongs to the default ui namespace (I18N §2)', () => {
    expect(splitKey('hud.money')).toEqual({ namespace: 'ui', id: 'hud.money' });
    expect(DEFAULT_NAMESPACE).toBe('ui');
  });

  test('a known prefix selects that namespace', () => {
    expect(splitKey('glossary:pasaran.term')).toEqual({
      namespace: 'glossary',
      id: 'pasaran.term',
    });
  });

  test('an unknown prefix stays part of the key so it reports as one missing key', () => {
    expect(splitKey('typo:hud.money')).toEqual({ namespace: 'ui', id: 'typo:hud.money' });
  });
});

describe('isNamespace', () => {
  test('recognises the generated namespaces only', () => {
    expect(isNamespace('ui')).toBe(true);
    expect(isNamespace('glossary')).toBe(true);
    expect(isNamespace('nope')).toBe(false);
  });
});
