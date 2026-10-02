import { expect, test } from 'bun:test';
import { loadArea } from './areas-bundle.ts';

test('the base area is Balé, with its ground, joglo, and kampung facade', async () => {
  const BALE_AREA = await loadArea('bale');
  expect(BALE_AREA.id).toBe('bale');
  expect(BALE_AREA.models).toEqual([
    'bale_ground_lvl0',
    'bale_joglo_lvl0',
    'bale_kampung_facade_lvl0',
  ]);
  expect(BALE_AREA.setoran).toEqual([2, -1]);
  expect(BALE_AREA.coop).toEqual([-6, 2]);
});

test('the spawn is clear of the field, the joglo and the kalen', async () => {
  const BALE_AREA = await loadArea('bale');
  const [x, z] = BALE_AREA.spawn;
  for (const rect of [BALE_AREA.field, BALE_AREA.joglo]) {
    const inside = x >= rect.x && x <= rect.x + rect.w && z >= rect.z && z <= rect.z + rect.d;
    expect(inside).toBe(false);
  }
  const kalenX = BALE_AREA.kalen.points[0]?.[0] ?? 0;
  expect(Math.abs(x - kalenX)).toBeGreaterThan(BALE_AREA.kalen.width);
});

test('loads Pasar Baledono as a separate area', async () => {
  const pasar = await loadArea('pasar');
  expect(pasar.id).toBe('pasar');
  expect(pasar.market).toEqual([3, -1]);
  expect(pasar.field).toBeUndefined();
});
