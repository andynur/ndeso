import { describe, expect, test } from 'bun:test';
import { areaOf, hashedUrl, type ModelSource, mergeSources, placeholderSources } from './build.ts';
import { readGlbJson } from './glb.ts';

const source = (id: string, origin: ModelSource['origin']): ModelSource => ({
  id,
  area: areaOf(id),
  bytes: new Uint8Array([origin === 'placeholder' ? 1 : 2]),
  origin,
});

describe('asset ids and urls', () => {
  test('the area is the first segment of a DESIGN §11 id', () => {
    expect(areaOf('bale_joglo_lvl0')).toBe('bale');
    expect(() => areaOf('Bale-Joglo')).toThrow();
  });

  test('urls are content-hashed under models/<area>/', () => {
    const a = hashedUrl('bale_joglo_lvl0', new Uint8Array([1, 2, 3]));
    expect(a).toMatch(/^models\/bale\/bale_joglo_lvl0-[0-9a-f]{8}\.glb$/);
    expect(hashedUrl('bale_joglo_lvl0', new Uint8Array([1, 2, 3]))).toBe(a);
    expect(hashedUrl('bale_joglo_lvl0', new Uint8Array([1, 2, 4]))).not.toBe(a);
  });
});

describe('sources', () => {
  test('a Blender export replaces the placeholder with the same id', () => {
    const merged = mergeSources(
      [source('bale_joglo_lvl0', 'placeholder'), source('bale_ground_lvl0', 'placeholder')],
      [source('bale_joglo_lvl0', 'assets-src')],
    );
    expect(merged.map((s) => [s.id, s.origin])).toEqual([
      ['bale_ground_lvl0', 'placeholder'],
      ['bale_joglo_lvl0', 'assets-src'],
    ]);
  });

  test('every model the base area lists has a placeholder', () => {
    const ids = placeholderSources().map((s) => s.id);
    expect(ids.sort()).toEqual(['bale_ground_lvl0', 'bale_joglo_lvl0']);
  });

  test('placeholders are deterministic', () => {
    const [a] = placeholderSources();
    const [b] = placeholderSources();
    expect(a?.bytes).toEqual(b?.bytes as Uint8Array);
    expect((readGlbJson(a?.bytes as Uint8Array) as { asset: unknown }).asset).toMatchObject({
      version: '2.0',
    });
  });
});
