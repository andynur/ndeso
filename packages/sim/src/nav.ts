import type { Vec2 } from '@bale/shared';
import type { CollisionGrid } from './collision.ts';

/**
 * Static NPC navigation over the same tile cells that block the player. The grid is derived
 * from area data and is never saved; routes are rebuilt deterministically when a schedule
 * target changes or a save is loaded.
 */
export interface NavGrid {
  readonly originX: number;
  readonly originZ: number;
  readonly width: number;
  readonly depth: number;
  /** Row-major, `1` = walkable. */
  readonly cells: Uint8Array;
}

export function buildNavGrid(collision: CollisionGrid): NavGrid {
  const cells = new Uint8Array(collision.cells.length);
  for (let index = 0; index < cells.length; index++) {
    cells[index] = collision.cells[index] === 0 ? 1 : 0;
  }
  return { ...collision, cells };
}

/** A deterministic north/east/south/west shortest route, returned as world-space centres. */
export function findNavPath(grid: NavGrid, from: Vec2, to: Vec2): Vec2[] | undefined {
  const start = cellOf(grid, from);
  const goal = cellOf(grid, to);
  if (!start || !goal) return undefined;
  const startIndex = indexOf(grid, start[0], start[1]);
  const goalIndex = indexOf(grid, goal[0], goal[1]);
  if (grid.cells[startIndex] !== 1 || grid.cells[goalIndex] !== 1) return undefined;
  if (startIndex === goalIndex) return [to];

  const previous = new Int32Array(grid.cells.length);
  previous.fill(-1);
  previous[startIndex] = startIndex;
  const queue = new Int32Array(grid.cells.length);
  queue[0] = startIndex;
  let head = 0;
  let tail = 1;
  while (head < tail && previous[goalIndex] === -1) {
    const current = queue[head++] as number;
    const col = current % grid.width;
    const row = Math.floor(current / grid.width);
    for (const [dc, dr] of NEIGHBOURS) {
      const nextCol = col + dc;
      const nextRow = row + dr;
      if (nextCol < 0 || nextRow < 0 || nextCol >= grid.width || nextRow >= grid.depth) continue;
      const next = indexOf(grid, nextCol, nextRow);
      if (grid.cells[next] !== 1 || previous[next] !== -1) continue;
      previous[next] = current;
      queue[tail++] = next;
    }
  }
  if (previous[goalIndex] === -1) return undefined;

  const reversed: number[] = [];
  for (let at = goalIndex; at !== startIndex; at = previous[at] as number) reversed.push(at);
  reversed.reverse();
  const path = reversed.map((index) => cellCentre(grid, index));
  path[path.length - 1] = to;
  return path;
}

const NEIGHBOURS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

function cellOf(grid: NavGrid, [x, z]: Vec2): readonly [number, number] | undefined {
  const col = Math.floor(x - grid.originX);
  const row = Math.floor(z - grid.originZ);
  return col >= 0 && row >= 0 && col < grid.width && row < grid.depth ? [col, row] : undefined;
}

const indexOf = (grid: NavGrid, col: number, row: number): number => row * grid.width + col;

function cellCentre(grid: NavGrid, index: number): Vec2 {
  return [
    grid.originX + (index % grid.width) + 0.5,
    grid.originZ + Math.floor(index / grid.width) + 0.5,
  ];
}
