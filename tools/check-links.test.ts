import { describe, expect, test } from 'bun:test';
import { extractLinks, headingAnchors, isExternal, slugify } from './check-links.ts';

describe('extractLinks', () => {
  test('finds inline links and images', () => {
    const refs = extractLinks('see [GDD](docs/GDD.md) and ![map](img/map.png)');
    expect(refs.map((ref) => ref.target)).toEqual(['docs/GDD.md', 'img/map.png']);
  });

  test('reports 1-based line numbers', () => {
    expect(extractLinks('a\nb\n[x](y.md)')[0]?.line).toBe(3);
  });

  test('ignores links inside fenced code blocks', () => {
    const markdown = ['```md', '[not a link](nope.md)', '```', '[real](yes.md)'].join('\n');
    expect(extractLinks(markdown).map((ref) => ref.target)).toEqual(['yes.md']);
  });

  test('ignores links inside inline code', () => {
    expect(extractLinks('use `[a](b.md)` here')).toEqual([]);
  });

  test('strips a link title', () => {
    expect(extractLinks('[x](y.md "the title")')[0]?.target).toBe('y.md');
  });
});

describe('slugify', () => {
  test('lowercases and hyphenates', () => {
    expect(slugify('Naming Policy')).toBe('naming-policy');
  });

  test('drops punctuation but keeps the space it sat next to', () => {
    expect(slugify('1. Naming policy')).toBe('1-naming-policy');
  });

  // The regression that made the first version of this tool reject working links.
  test('emits one hyphen per space, so a dropped em dash leaves a double hyphen', () => {
    expect(slugify('1. Naming policy — read this first')).toBe('1-naming-policy--read-this-first');
  });

  test('drops parentheses, semicolons and emphasis markers', () => {
    expect(slugify('2. Glossary seeds (keep terms consistent; also the *Kamus*)')).toBe(
      '2-glossary-seeds-keep-terms-consistent-also-the-kamus',
    );
  });
});

describe('headingAnchors', () => {
  test('collects every heading level', () => {
    const anchors = headingAnchors('# One\n\ntext\n\n### Three Deep\n');
    expect(anchors.has('one')).toBe(true);
    expect(anchors.has('three-deep')).toBe(true);
  });

  test('ignores a hash that is not a heading', () => {
    expect(headingAnchors('not # a heading').size).toBe(0);
  });
});

describe('isExternal', () => {
  test.each([
    ['https://example.com', true],
    ['http://example.com', true],
    ['mailto:a@b.c', true],
    ['#anchor', true],
    ['docs/GDD.md', false],
    ['../README.md', false],
  ])('%s → %s', (target, expected) => {
    expect(isExternal(target)).toBe(expected);
  });
});
