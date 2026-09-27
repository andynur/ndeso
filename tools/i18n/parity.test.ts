import { describe, expect, test } from 'bun:test';
import {
  compareNamespace,
  compareNamespaceSets,
  type Problem,
  TODO_PREFIX,
  validateBundle,
} from './parity.ts';

function compare(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  allowTodo = true,
): Problem[] {
  return compareNamespace({
    namespace: 'ui',
    sourceLocale: 'en',
    targetLocale: 'id',
    source,
    target,
    allowTodo,
  });
}

describe('key parity', () => {
  test('a key removed from the translation is an error (M0-04 acceptance criterion)', () => {
    const problems = compare({ 'common.ok': 'OK', 'common.back': 'Back' }, { 'common.ok': 'OK' });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.level).toBe('error');
    expect(problems[0]?.where).toBe('id/ui.json → common.back');
    expect(problems[0]?.message).toContain('missing key');
  });

  test('a key that exists only in the translation is an error too', () => {
    const problems = compare({ 'common.ok': 'OK' }, { 'common.ok': 'OK', 'common.ya': 'Ya' });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toContain('extra key');
  });

  test('matching bundles produce no problems', () => {
    expect(compare({ 'common.ok': 'OK' }, { 'common.ok': 'OK' })).toEqual([]);
  });
});

describe('placeholder parity (I18N §1 rule 5)', () => {
  test('a dropped placeholder is an error', () => {
    const problems = compare({ 'hud.day': '{season} day {day}' }, { 'hud.day': 'hari ke-{day}' });
    expect(problems).toHaveLength(1);
    expect(problems[0]?.message).toBe('placeholder(s) missing: {season}');
  });

  test('an invented placeholder is an error', () => {
    const problems = compare({ 'save.saved': 'Game saved' }, { 'save.saved': 'Tersimpan {slot}' });
    expect(problems[0]?.message).toBe('unknown placeholder(s): {slot}');
  });

  test('plural in EN and a plain placeholder in ID is fine — the names match', () => {
    expect(
      compare(
        {
          'ship.summary': 'You earned {money} from {count, plural, one {# item} other {# items}}.',
        },
        { 'ship.summary': 'Kamu mendapat {money} dari {count} barang.' },
      ),
    ).toEqual([]);
  });
});

describe('[TODO-ID] policy (I18N §1 rule 3)', () => {
  const source = { 'common.back': 'Back' };
  const target = { 'common.back': `${TODO_PREFIX}Back` };

  test('warns on a branch', () => {
    const [problem] = compare(source, target, true);
    expect(problem?.level).toBe('warn');
  });

  test('fails on main and release tags', () => {
    const [problem] = compare(source, target, false);
    expect(problem?.level).toBe('error');
  });
});

describe('validateBundle', () => {
  test('rejects nested objects — namespaces are flat (I18N §2)', () => {
    const [problem] = validateBundle('en', 'ui', { common: { ok: 'OK' } });
    expect(problem?.message).toContain('value must be a string');
  });

  test('rejects an empty string', () => {
    const [problem] = validateBundle('id', 'ui', { 'common.ok': '   ' });
    expect(problem?.message).toBe('value is empty');
  });

  test('rejects a message our ICU subset cannot parse', () => {
    const [problem] = validateBundle('en', 'ui', { 'x.y': '{count, plural, one {# egg}}' });
    expect(problem?.message).toContain('unparseable message');
  });

  test('accepts the shapes we do support', () => {
    expect(
      validateBundle('en', 'ui', {
        'a.b': 'Plain',
        'a.c': 'With {name}',
        'a.d': '{count, plural, one {# egg} other {# eggs}}',
      }),
    ).toEqual([]);
  });
});

describe('compareNamespaceSets', () => {
  test('flags a namespace file a locale is missing', () => {
    const [problem] = compareNamespaceSets('en', ['ui', 'glossary'], 'id', ['ui']);
    expect(problem?.where).toBe('id/glossary.json');
    expect(problem?.message).toContain('missing namespace file');
  });

  test('flags a namespace file with no source counterpart', () => {
    const [problem] = compareNamespaceSets('en', ['ui'], 'id', ['ui', 'npcs']);
    expect(problem?.message).toContain('no counterpart');
  });
});
