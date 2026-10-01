import { describe, expect, test } from 'bun:test';
import { compareInkStructure, inspectInk } from './ink-parity.ts';

const source = `=== hello ===
# speaker:test
Hello.
* [One]
  First.
  -> END
* [Two]
  Second.
  -> END`;

describe('Ink structure parity', () => {
  test('allows translated prose with the same compiled flow', () => {
    const target = source.replace('Hello.', 'Halo.').replace('First.', 'Pertama.');
    expect(compareInkStructure(inspectInk(source, 'en'), inspectInk(target, 'id'), 'id')).toEqual(
      [],
    );
  });

  test('reports a translated choice-count change', () => {
    const target = `=== hello ===
# speaker:test
Halo.
* [Satu]
  Pertama.
  -> END`;
    expect(
      compareInkStructure(inspectInk(source, 'en'), inspectInk(target, 'id'), 'id')[0],
    ).toContain('1 choices; source has 2');
  });

  test('reports logic-tag drift', () => {
    const target = source.replace('speaker:test', 'speaker:other');
    expect(
      compareInkStructure(inspectInk(source, 'en'), inspectInk(target, 'id'), 'id')[0],
    ).toContain('tags differ');
  });
});
