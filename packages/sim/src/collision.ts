import { type AreaDef, CROSSING_WIDTH, type GroundRect, type Vec2 } from '@bale/shared';

/**
 * The walk grid (M1-06): one cell per tile over the area, built once from the area file,
 * so the placeholder boxes, the final art and the collision all come from the same numbers.
 * A cell is solid when its centre lies on the joglo's platform or in the kalen (except
 * where a plank crosses it). Everything outside the area is solid too.
 *
 * Static data, not state: it is rebuilt from the area on load and never saved.
 */
export interface CollisionGrid {
  /** World x of the west edge of column 0. */
  readonly originX: number;
  /** World z of the north edge of row 0. */
  readonly originZ: number;
  readonly width: number;
  readonly depth: number;
  /** Row-major, `1` = solid. */
  readonly cells: Uint8Array;
}

export function buildCollisionGrid(area: AreaDef): CollisionGrid {
  const [w, d] = area.size;
  const width = Math.ceil(w);
  const depth = Math.ceil(d);
  const originX = -w / 2;
  const originZ = -d / 2;
  const cells = new Uint8Array(width * depth);

  for (let row = 0; row < depth; row++) {
    for (let col = 0; col < width; col++) {
      const x = originX + col + 0.5;
      const z = originZ + row + 0.5;
      const solid =
        inRect(area.joglo, x, z) || inTile(area.coop, x, z) || inKalen(area.kalen, x, z);
      cells[row * width + col] = solid ? 1 : 0;
    }
  }
  return { originX, originZ, width, depth, cells };
}

/** Whether the tile under world point `(x, z)` is solid; off the grid counts as solid. */
export function isSolid(grid: CollisionGrid, x: number, z: number): boolean {
  return isSolidCell(grid, Math.floor(x - grid.originX), Math.floor(z - grid.originZ));
}

function isSolidCell(grid: CollisionGrid, col: number, row: number): boolean {
  if (col < 0 || row < 0 || col >= grid.width || row >= grid.depth) return true;
  return grid.cells[row * grid.width + col] === 1;
}

/** Whether the square of half-edge `r` centred on `(x, z)` touches a solid tile. */
export function boxHitsSolid(grid: CollisionGrid, x: number, z: number, r: number): boolean {
  const col0 = Math.floor(x - r - grid.originX);
  const col1 = Math.floor(x + r - grid.originX);
  const row0 = Math.floor(z - r - grid.originZ);
  const row1 = Math.floor(z + r - grid.originZ);
  for (let row = row0; row <= row1; row++) {
    for (let col = col0; col <= col1; col++) {
      if (isSolidCell(grid, col, row)) return true;
    }
  }
  return false;
}

const inRect = (rect: GroundRect, x: number, z: number): boolean =>
  x >= rect.x && x <= rect.x + rect.w && z >= rect.z && z <= rect.z + rect.d;

const inTile = ([tx, tz]: Vec2, x: number, z: number): boolean =>
  x >= tx && x < tx + 1 && z >= tz && z < tz + 1;

function inKalen(kalen: AreaDef['kalen'], x: number, z: number): boolean {
  const half = kalen.width / 2;
  const { points } = kalen;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1] as Vec2;
    const b = points[i] as Vec2;
    if (distanceToSegment(a, b, x, z) > half) continue;
    // Segments are axis-aligned (validateArea); a crossing opens the cells within half its
    // width along the channel and the whole channel across it.
    const alongZ = a[0] === b[0];
    const crossed = kalen.crossings.some(([cx, cz]) => {
      const along = alongZ ? Math.abs(z - cz) : Math.abs(x - cx);
      const across = alongZ ? Math.abs(x - cx) : Math.abs(z - cz);
      return along < CROSSING_WIDTH / 2 && across <= half;
    });
    return !crossed;
  }
  return false;
}

function distanceToSegment([ax, az]: Vec2, [bx, bz]: Vec2, x: number, z: number): number {
  const dx = Math.max(Math.min(ax, bx) - x, 0, x - Math.max(ax, bx));
  const dz = Math.max(Math.min(az, bz) - z, 0, z - Math.max(az, bz));
  return Math.hypot(dx, dz);
}
