import { type AreaDef, type PlayerData, TICKS_PER_SECOND } from '@bale/shared';
import { boxHitsSolid, type CollisionGrid } from '../collision.ts';
import type { System } from '../types.ts';

/**
 * Player movement, the movement half of the `commands` system (ARCHITECTURE §3.2, step 3):
 * holds the latest `move` intent in state and walks the player along it every tick,
 * sliding along whatever the collision grid says is solid.
 */

/** Gap left between the player and a wall, so the next test does not touch it. */
const SKIN = 1e-4;

/** World facing: north is −z, east is +x. */
export type Dir = 'north' | 'east' | 'south' | 'west';

export interface PlayerState {
  area: string;
  x: number;
  z: number;
  facing: Dir;
  /** The held `move` intent, length ≤ 1; `{0, 0}` when standing. */
  moveX: number;
  moveZ: number;
}

export interface MovementState {
  player: PlayerState;
}

export function createPlayerState(area: AreaDef): PlayerState {
  const [x, z] = area.spawn;
  return { area: area.id, x, z, facing: 'south', moveX: 0, moveZ: 0 };
}

/** Whether the player is walking: render plays the walk cycle while this is true. */
export const isMoving = (player: Readonly<PlayerState>): boolean =>
  player.moveX !== 0 || player.moveZ !== 0;

/**
 * The facing an intent turns the player to: its dominant axis. On an exact diagonal the
 * player keeps a facing that is one of the two, so a stick held at 45° does not flicker.
 */
export function facingOf(x: number, z: number, current: Dir): Dir {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  if (ax === 0 && az === 0) return current;
  const horizontal: Dir = x > 0 ? 'east' : 'west';
  const vertical: Dir = z > 0 ? 'south' : 'north';
  if (ax > az) return horizontal;
  if (az > ax) return vertical;
  return current === vertical ? vertical : horizontal;
}

/** `data` is `content/data/player.json5`: walk speed and collision size. */
export function createMovementSystem(grid: CollisionGrid, data: PlayerData): System<MovementState> {
  const step = data.speed / TICKS_PER_SECOND;
  const r = data.radius;
  return (state, ctx) => {
    const { player } = state;
    // Only the last intent of the step counts: intents are held, not summed.
    for (const command of ctx.commands) {
      if (command.type !== 'move') continue;
      player.moveX = command.x;
      player.moveZ = command.z;
    }
    if (!isMoving(player)) return;
    player.facing = facingOf(player.moveX, player.moveZ, player.facing);
    for (let i = 0; i < ctx.ticks; i++) {
      moveAxis(player, grid, r, 'x', player.moveX * step);
      moveAxis(player, grid, r, 'z', player.moveZ * step);
    }
  };
}

/**
 * Moves along one axis and, on hitting a solid tile, stops flush against its edge. The
 * step is under one tile, so the only tile it can reach is the next one.
 */
function moveAxis(
  player: PlayerState,
  grid: CollisionGrid,
  r: number,
  axis: 'x' | 'z',
  delta: number,
): void {
  if (delta === 0) return;
  const next = player[axis] + delta;
  const hit =
    axis === 'x' ? boxHitsSolid(grid, next, player.z, r) : boxHitsSolid(grid, player.x, next, r);
  if (!hit) {
    player[axis] = next;
    return;
  }
  const origin = axis === 'x' ? grid.originX : grid.originZ;
  const edge =
    delta > 0
      ? origin + Math.floor(next + r - origin) - r - SKIN
      : origin + Math.floor(next - r - origin) + 1 + r + SKIN;
  // Never step backwards: if the edge is behind us, stay put.
  player[axis] = delta > 0 ? Math.max(player[axis], edge) : Math.min(player[axis], edge);
}
