/**
 * Tile collision for one area (GDD §11: 1 world unit = 1 tile). Tile `(tx, tz)` covers
 * `[tx, tx + 1) × [tz, tz + 1)` in world space. The grid is area data, not game state: it
 * never changes while the player is in the area, so it is handed to the system that needs it
 * rather than saved.
 */

export interface CollisionGrid {
  /** World coordinates of the grid's corner tile. */
  readonly originX: number;
  readonly originZ: number;
  /** Size in tiles. Everything outside is solid, so the area's edge is a wall. */
  readonly width: number;
  readonly depth: number;
  /** Row-major (`z * width + x`), `1` = solid. */
  readonly solid: Uint8Array;
}

export function createCollisionGrid(
  originX: number,
  originZ: number,
  width: number,
  depth: number,
): CollisionGrid {
  if (![originX, originZ, width, depth].every(Number.isInteger) || width < 1 || depth < 1) {
    throw new Error(`invalid collision grid ${originX},${originZ} ${width}×${depth}`);
  }
  return { originX, originZ, width, depth, solid: new Uint8Array(width * depth) };
}

/** Marks the tiles in world rect `[x0, x1) × [z0, z1)` solid; parts off the grid are ignored. */
export function blockRect(grid: CollisionGrid, x0: number, z0: number, x1: number, z1: number) {
  for (let tz = z0; tz < z1; tz++) {
    for (let tx = x0; tx < x1; tx++) {
      const i = indexOf(grid, tx, tz);
      if (i >= 0) grid.solid[i] = 1;
    }
  }
}

/** Whether world tile `(tx, tz)` blocks movement. Off the grid is solid. */
export function isSolid(grid: CollisionGrid, tx: number, tz: number): boolean {
  const i = indexOf(grid, tx, tz);
  return i < 0 || grid.solid[i] === 1;
}

function indexOf(grid: CollisionGrid, tx: number, tz: number): number {
  const x = tx - grid.originX;
  const z = tz - grid.originZ;
  if (x < 0 || z < 0 || x >= grid.width || z >= grid.depth) return -1;
  return z * grid.width + x;
}
