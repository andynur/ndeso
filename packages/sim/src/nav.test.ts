import { beforeAll, describe, expect, test } from 'bun:test';
import type { FarmAreaDef } from '@bale/shared';
import { buildCollisionGrid } from './collision.ts';
import { buildNavGrid, findNavPath, type NavGrid } from './nav.ts';
import { loadAreaForTests } from './testing/area-data.ts';

let area: FarmAreaDef;
let nav: NavGrid;
beforeAll(async () => {
  area = await loadAreaForTests('bale');
  nav = buildNavGrid(buildCollisionGrid(area));
});

describe('NPC nav grid', () => {
  test('inverts collision cells into one walkability cell per tile', () => {
    expect(nav.cells.length).toBe(nav.width * nav.depth);
    expect(nav.cells.filter(Boolean).length).toBeGreaterThan(0);
    expect(nav.cells.every((cell) => cell === 0 || cell === 1)).toBe(true);
  });

  test('routes around the joglo with deterministic cardinal steps', () => {
    const route = findNavPath(nav, [-5.5, -4.5], [4.5, -4.5]);
    expect(route).toBeDefined();
    expect(route?.at(-1)).toEqual([4.5, -4.5]);
    expect(route?.some(([, z]) => z < area.joglo.z || z > area.joglo.z + area.joglo.d)).toBe(true);
    for (let index = 1; index < (route?.length ?? 0); index++) {
      const [ax, az] = route?.[index - 1] ?? [0, 0];
      const [bx, bz] = route?.[index] ?? [0, 0];
      expect(Math.abs(ax - bx) + Math.abs(az - bz)).toBeCloseTo(1);
    }
  });

  test('uses the plank to cross the kalen and rejects a solid destination', () => {
    const route = findNavPath(nav, [4.5, -4.5], [7.5, -4.5]);
    expect(route?.some(([x, z]) => x === 5.5 && (z === 2.5 || z === 3.5))).toBe(true);
    expect(findNavPath(nav, [0.5, 3.5], [0.5, -4.5])).toBeUndefined();
  });
});
