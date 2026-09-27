import { describe, expect, test } from 'bun:test';
import { formatMessage, MessageSyntaxError, messagePlaceholders, parseMessage } from './message.ts';

describe('formatMessage — placeholders', () => {
  test('substitutes named values', () => {
    expect(formatMessage('en', 'You earned {money}.', { money: 'Rp12,500' })).toBe(
      'You earned Rp12,500.',
    );
  });

  test('keeps a missing value visible instead of rendering undefined', () => {
    expect(formatMessage('en', 'You earned {money}.')).toBe('You earned {money}.');
  });

  test('passes text through untouched when there is nothing to substitute', () => {
    expect(formatMessage('id', 'Permainan tersimpan')).toBe('Permainan tersimpan');
  });
});

describe('formatMessage — plural', () => {
  const pattern = 'You earned {money} from {count, plural, one {# item} other {# items}}.';

  test('picks the English one/other branches and formats #', () => {
    expect(formatMessage('en', pattern, { money: 'Rp800', count: 1 })).toBe(
      'You earned Rp800 from 1 item.',
    );
    expect(formatMessage('en', pattern, { money: 'Rp800', count: 4 })).toBe(
      'You earned Rp800 from 4 items.',
    );
  });

  test('Indonesian only has other, so both counts read the same (I18N §3)', () => {
    const id = 'Kamu mendapat {money} dari {count} barang.';
    expect(formatMessage('id', id, { money: 'Rp800', count: 1 })).toBe(
      'Kamu mendapat Rp800 dari 1 barang.',
    );
  });

  test('an exact =0 selector wins over the plural category', () => {
    const zero = '{count, plural, =0 {nothing} one {# egg} other {# eggs}}';
    expect(formatMessage('en', zero, { count: 0 })).toBe('nothing');
    expect(formatMessage('en', zero, { count: 2 })).toBe('2 eggs');
  });

  test('# uses the locale number format', () => {
    expect(formatMessage('id', '{n, plural, other {# butir}}', { n: 12500 })).toBe('12.500 butir');
  });
});

describe('formatMessage — select', () => {
  const pattern = '{gender, select, female {Dia} male {Dia} other {Mereka}} datang.';

  test('picks the named branch and falls back to other', () => {
    expect(formatMessage('id', pattern, { gender: 'female' })).toBe('Dia datang.');
    expect(formatMessage('id', pattern, { gender: 'nonbinary' })).toBe('Mereka datang.');
    expect(formatMessage('id', pattern)).toBe('Mereka datang.');
  });
});

describe('messagePlaceholders', () => {
  test('collects names from the top level and from inside branches', () => {
    const names = messagePlaceholders(
      '{who} earned {money} from {count, plural, one {# {unit}} other {# {unit}s}}.',
    );
    expect([...names].sort()).toEqual(['count', 'money', 'unit', 'who']);
  });

  test('a message with no placeholders yields an empty set', () => {
    expect(messagePlaceholders('Menyimpan…').size).toBe(0);
  });
});

describe('parseMessage — rejects what we do not support', () => {
  test.each([
    ['{count, plural, one {# egg}}', 'no other branch'],
    ['{count, selectordinal, other {#}}', 'unsupported type'],
    ['{}', 'empty name'],
    ['Hello {name', 'unterminated'],
    ['Hello }', 'unbalanced brace'],
  ])('%s → %s', (pattern) => {
    expect(() => parseMessage(pattern)).toThrow(MessageSyntaxError);
  });

  test('the error names the message so a translator can find it', () => {
    expect(() => parseMessage('{count, plural, one {# egg}}')).toThrow(/no 'other' branch/);
  });
});
