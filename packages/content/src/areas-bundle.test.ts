import { expect, test } from 'bun:test';
import { BALE_AREA } from './areas-bundle.ts';

test('the base area is Balé, with its ground and its joglo', () => {
  expect(BALE_AREA.id).toBe('bale');
  expect(BALE_AREA.models).toEqual(['bale_ground_lvl0', 'bale_joglo_lvl0']);
});

test('the spawn is clear of the field, the joglo and the kalen', () => {
  const [x, z] = BALE_AREA.spawn;
  for (const rect of [BALE_AREA.field, BALE_AREA.joglo]) {
    const inside = x >= rect.x && x <= rect.x + rect.w && z >= rect.z && z <= rect.z + rect.d;
    expect(inside).toBe(false);
  }
  const kalenX = BALE_AREA.kalen.points[0]?.[0] ?? 0;
  expect(Math.abs(x - kalenX)).toBeGreaterThan(BALE_AREA.kalen.width);
});
