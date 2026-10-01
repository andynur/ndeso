import { expect, test } from 'bun:test';
import { buildPlaceholderAnimalAtlas } from './placeholder-animal-atlas.ts';

test('builds stable chicken care tags in one generated placeholder atlas', () => {
  const result = buildPlaceholderAnimalAtlas({
    outline: 0x1b1410,
    body: 0xfbf6ec,
    comb: 0xd23c3c,
    beak: 0xf2b632,
  });
  expect(Object.keys(result.atlas.tags)).toEqual(['idle', 'happy', 'hungry']);
  expect(result.atlas.frames).toHaveLength(6);
  expect(result.pixels.some((channel) => channel !== 0)).toBe(true);
});
