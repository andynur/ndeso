import { expect, test } from 'bun:test';
import { validatePlayer } from './player.ts';

test('accepts sane movement numbers', () => {
  expect(validatePlayer({ speed: 4, radius: 0.3, inventory: [] })).toEqual({
    ok: true,
    data: { speed: 4, radius: 0.3, inventory: [] },
  });
});

test('rejects a speed that could tunnel through a tile, and a radius that cannot fit a gap', () => {
  const result = validatePlayer({ speed: 12, radius: 0.5, inventory: [] });
  expect(result.ok ? [] : result.errors).toEqual([
    'player.json5: speed must be a number in (0, 9] tiles/s',
    'player.json5: radius must be a number in (0, 0.5) tiles',
  ]);
});

test('rejects malformed, duplicate, and oversized hotbar loadouts', () => {
  const inventory = Array.from({ length: 10 }, () => ({ kind: 'tool', id: 'hoe' }));
  const result = validatePlayer({ speed: 4, radius: 0.3, inventory });
  expect(result.ok ? [] : result.errors).toEqual([
    'player.json5: inventory must be a list of at most 9 entries',
  ]);
});
