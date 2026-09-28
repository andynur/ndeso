import { TICK_MS } from '@bale/shared';
import { type CollisionGrid, isSolid } from './collision.ts';

/**
 * The player's body in the world (ARCHITECTURE §3.3 `player`). Only position, facing and
 * the held movement intent so far; stamina, money and inventory join with the systems that
 * change them, and `area` with the second area (M1-09 builds only one).
 */

export interface Vec2 {
  x: number;
  z: number;
}

/**
 * World-space facing, one of four so "the tile in front" (GDD §12 auto-target) is always
 * a single tile. North is −z: up the screen at camera yaw 0.
 */
export type Dir = 'north' | 'east' | 'south' | 'west';

export const DIR_HEADINGS: Readonly<Record<Dir, Readonly<Vec2>>> = {
  north: { x: 0, z: -1 },
  east: { x: 1, z: 0 },
  south: { x: 0, z: 1 },
  west: { x: -1, z: 0 },
};

export interface PlayerState {
  player: {
    pos: Vec2;
    facing: Dir;
    /** The last `move` command, held until the next one (length ≤ 1). */
    intent: Vec2;
  };
}

/**
 * Walking speed in tiles per second. Not a GDD number yet — proposed in the M1-06 PR.
 * Must stay below one tile per tick: `movePlayer` only checks the next tile over.
 */
export const WALK_SPEED = 3;
/** Half the side of the player's square footprint, in tiles. */
export const PLAYER_RADIUS = 0.3;

const STEP_PER_TICK = (WALK_SPEED * TICK_MS) / 1000;

export function createPlayerState(spawn: Readonly<Vec2>, facing: Dir = 'south'): PlayerState {
  return { player: { pos: { x: spawn.x, z: spawn.z }, facing, intent: { x: 0, z: 0 } } };
}

/** Whether the player is trying to walk; they walk in place against a wall. */
export function isWalking(player: Readonly<PlayerState['player']>): boolean {
  return player.intent.x !== 0 || player.intent.z !== 0;
}

/**
 * The facing a movement intent turns the player to: the dominant axis wins. On an exact
 * diagonal (two keys held) the current facing is kept if it is one of the two, so pressing
 * a second key does not snap the sprite round.
 */
export function facingFor(x: number, z: number, current: Dir): Dir {
  if (x === 0 && z === 0) return current;
  const ew: Dir = x > 0 ? 'east' : 'west';
  const ns: Dir = z > 0 ? 'south' : 'north';
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax > az) return ew;
  if (az > ax) return ns;
  // Keep east/west if already facing it; else face along z (the front and back sprites).
  return current === ew ? ew : ns;
}

/**
 * One tick of walking along the held intent. Each axis moves and resolves on its own, so
 * walking diagonally into a wall slides along it instead of stopping dead.
 */
export function movePlayer(state: PlayerState, grid: CollisionGrid): void {
  const { player } = state;
  const { intent, pos } = player;
  player.facing = facingFor(intent.x, intent.z, player.facing);
  if (intent.x !== 0) pos.x = sweep(pos.x, pos.z, intent.x * STEP_PER_TICK, grid, true);
  if (intent.z !== 0) pos.z = sweep(pos.z, pos.x, intent.z * STEP_PER_TICK, grid, false);
}

/**
 * Moves the footprint `delta` along one axis (`along`), with `across` the other axis'
 * coordinate, and stops flush against the first solid tile. The footprint covers
 * `[c − r, c + r)`, so a box touching a tile edge does not overlap that tile.
 */
function sweep(
  along: number,
  across: number,
  delta: number,
  grid: CollisionGrid,
  alongX: boolean,
): number {
  const r = PLAYER_RADIUS;
  const next = along + delta;
  const lead = delta > 0 ? Math.ceil(next + r) - 1 : Math.floor(next - r);
  const from = Math.floor(across - r);
  const to = Math.ceil(across + r) - 1;
  for (let t = from; t <= to; t++) {
    if (alongX ? isSolid(grid, lead, t) : isSolid(grid, t, lead)) {
      return delta > 0 ? lead - r : lead + 1 + r;
    }
  }
  return next;
}
