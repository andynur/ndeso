import { describe, expect, test } from 'bun:test';
import { blockRect, createCollisionGrid, isSolid } from './collision.ts';

describe('collision grid', () => {
  test('starts open inside and solid outside', () => {
    const grid = createCollisionGrid(-2, -3, 4, 5);
    expect(isSolid(grid, -2, -3)).toBe(false);
    expect(isSolid(grid, 1, 1)).toBe(false);
    expect(isSolid(grid, -3, 0)).toBe(true);
    expect(isSolid(grid, 2, 0)).toBe(true);
    expect(isSolid(grid, 0, -4)).toBe(true);
    expect(isSolid(grid, 0, 2)).toBe(true);
  });

  test('blockRect marks a half-open world rect and ignores what is off the grid', () => {
    const grid = createCollisionGrid(0, 0, 4, 4);
    blockRect(grid, -1, 1, 2, 3);
    expect(isSolid(grid, 0, 1)).toBe(true);
    expect(isSolid(grid, 1, 2)).toBe(true);
    expect(isSolid(grid, 2, 1)).toBe(false);
    expect(isSolid(grid, 0, 3)).toBe(false);
    expect(grid.solid.reduce((a, b) => a + b, 0)).toBe(4);
  });

  test('rejects a non-integer or empty grid', () => {
    expect(() => createCollisionGrid(0.5, 0, 4, 4)).toThrow();
    expect(() => createCollisionGrid(0, 0, 0, 4)).toThrow();
  });
});
