import { beforeAll, describe, expect, test } from 'bun:test';
import type { FarmAreaDef } from '@bale/shared';
import { boxHitsSolid, buildCollisionGrid, type CollisionGrid, isSolid } from './collision.ts';
import { loadAreaForTests } from './testing/area-data.ts';

let area: FarmAreaDef;
let grid: CollisionGrid;
beforeAll(async () => {
  area = await loadAreaForTests('bale');
  grid = buildCollisionGrid(area);
});

describe('collision grid from bale.json5', () => {
  test('one cell per tile over the area', () => {
    expect(grid.width).toBe(area.size[0]);
    expect(grid.depth).toBe(area.size[1]);
    expect(grid.cells.length).toBe(area.size[0] * area.size[1]);
  });

  test('the spawn and the field are walkable', () => {
    const [x, z] = area.spawn;
    expect(isSolid(grid, x, z)).toBe(false);
    const { field } = area;
    for (let z = field.z + 0.5; z < field.z + field.d; z++) {
      for (let x = field.x + 0.5; x < field.x + field.w; x++) {
        expect(isSolid(grid, x, z)).toBe(false);
      }
    }
  });

  test('the joglo platform is solid', () => {
    const { joglo } = area;
    expect(isSolid(grid, joglo.x + 0.5, joglo.z + 0.5)).toBe(true);
    expect(isSolid(grid, joglo.x + joglo.w - 0.5, joglo.z + joglo.d - 0.5)).toBe(true);
    expect(isSolid(grid, joglo.x - 0.5, joglo.z + 0.5)).toBe(false);
  });

  test('the kalen is solid except under its plank', () => {
    const [kx] = area.kalen.points[0] ?? [0, 0];
    const [, crossZ] = area.kalen.crossings[0] ?? [0, 0];
    expect(isSolid(grid, kx, crossZ - 4)).toBe(true);
    expect(isSolid(grid, kx, crossZ + 4)).toBe(true);
    expect(isSolid(grid, kx, crossZ - 0.5)).toBe(false);
    expect(isSolid(grid, kx, crossZ + 0.5)).toBe(false);
    // Its banks are ground.
    expect(isSolid(grid, kx - 1, crossZ - 4)).toBe(false);
    expect(isSolid(grid, kx + 1, crossZ - 4)).toBe(false);
  });

  test('outside the area is solid', () => {
    expect(isSolid(grid, area.size[0], 0)).toBe(true);
    expect(isSolid(grid, 0, -area.size[1])).toBe(true);
  });

  test('a box touching a solid tile hits it', () => {
    const { joglo } = area;
    const below = joglo.z + joglo.d;
    expect(boxHitsSolid(grid, 0, below + 0.31, 0.3)).toBe(false);
    expect(boxHitsSolid(grid, 0, below + 0.29, 0.3)).toBe(true);
  });
});
