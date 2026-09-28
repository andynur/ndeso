import { beforeAll, describe, expect, test } from 'bun:test';
import { type AreaDef, type PlayerData, TICKS_PER_SECOND } from '@bale/shared';
import { buildCollisionGrid, type CollisionGrid } from '../collision.ts';
import type { Command } from '../commands.ts';
import { loadAreaForTests, loadPlayerForTests } from '../testing/area-data.ts';
import { createContext, type System } from '../types.ts';
import {
  createMovementSystem,
  createPlayerState,
  facingOf,
  isMoving,
  type MovementState,
} from './movement.ts';

let area: AreaDef;
let grid: CollisionGrid;
let data: PlayerData;
let system: System<MovementState>;
beforeAll(async () => {
  area = await loadAreaForTests('bale');
  data = await loadPlayerForTests();
  grid = buildCollisionGrid(area);
  system = createMovementSystem(grid, data);
});

const move = (x: number, z: number): Command => ({ type: 'move', x, z });

/** Sends `commands` on the first tick, then runs `ticks - 1` more without any. */
function run(state: MovementState, ticks: number, commands: Command[] = []): MovementState {
  system(state, createContext(1, commands));
  for (let i = 1; i < ticks; i++) system(state, createContext(1));
  return state;
}

const fresh = (): MovementState => ({ player: createPlayerState(area) });

describe('movement system', () => {
  test('starts at the spawn, standing, facing the camera', () => {
    const { player } = fresh();
    expect([player.x, player.z]).toEqual([...area.spawn]);
    expect(player.facing).toBe('south');
    expect(isMoving(player)).toBe(false);
  });

  test('holds the intent between ticks and walks at the data speed', () => {
    const state = run(fresh(), TICKS_PER_SECOND, [move(-1, 0)]);
    expect(state.player.x).toBeCloseTo(area.spawn[0] - data.speed, 9);
    expect(state.player.z).toBe(area.spawn[1]);
    expect(state.player.facing).toBe('west');
    expect(isMoving(state.player)).toBe(true);
  });

  test('a half-pushed stick walks at half speed', () => {
    const state = run(fresh(), TICKS_PER_SECOND, [move(0, 0.5)]);
    expect(state.player.z).toBeCloseTo(area.spawn[1] + data.speed / 2, 9);
    expect(state.player.facing).toBe('south');
  });

  test('{0, 0} stops the player and keeps the facing', () => {
    const state = run(fresh(), 3, [move(1, 0)]);
    const x = state.player.x;
    run(state, 5, [move(0, 0)]);
    expect(state.player.x).toBe(x);
    expect(state.player.facing).toBe('east');
    expect(isMoving(state.player)).toBe(false);
  });

  test('the joglo stops the player flush against its platform', () => {
    const state = run(fresh(), TICKS_PER_SECOND * 5, [move(0, -1)]);
    const front = area.joglo.z + area.joglo.d;
    expect(state.player.z).toBeCloseTo(front + data.radius, 3);
    expect(state.player.z).toBeGreaterThan(front + data.radius);
    expect(state.player.facing).toBe('north');
  });

  test('slides along a wall on a diagonal', () => {
    // 1.3 s: long enough to reach the platform, too short to walk past its west end.
    const state = run(fresh(), 13, [move(-0.7, -0.7)]);
    const front = area.joglo.z + area.joglo.d;
    expect(state.player.z).toBeCloseTo(front + data.radius, 3);
    // Blocked on z, still walking west along the platform.
    expect(state.player.x).toBeCloseTo(
      area.spawn[0] - 13 * 0.7 * (data.speed / TICKS_PER_SECOND),
      9,
    );
  });

  test('the kalen blocks, but the plank crosses it', () => {
    const [kx] = area.kalen.points[0] ?? [0, 0];
    const [, crossZ] = area.kalen.crossings[0] ?? [0, 0];
    const blocked = fresh();
    blocked.player.z = crossZ - 4;
    run(blocked, TICKS_PER_SECOND * 5, [move(1, 0)]);
    expect(blocked.player.x).toBeLessThan(kx - area.kalen.width / 2);

    const crossing = fresh();
    crossing.player.z = crossZ;
    run(crossing, TICKS_PER_SECOND * 5, [move(1, 0)]);
    expect(crossing.player.x).toBeGreaterThan(kx + area.kalen.width / 2);
  });

  test('the area edge is solid', () => {
    const state = run(fresh(), TICKS_PER_SECOND * 20, [move(0, 1)]);
    expect(state.player.z).toBeLessThan(area.size[1] / 2 - data.radius);
    expect(state.player.z).toBeCloseTo(area.size[1] / 2 - data.radius, 3);
  });

  test('catching up several ticks at once walks as far as ticking one by one', () => {
    const a = run(fresh(), 7, [move(0.6, 0.8)]);
    const b = fresh();
    system(b, createContext(7, [move(0.6, 0.8)]));
    expect(b.player.x).toBeCloseTo(a.player.x, 9);
    expect(b.player.z).toBeCloseTo(a.player.z, 9);
  });

  test('the last move of a step wins', () => {
    const state = run(fresh(), 1, [move(1, 0), move(0, 0)]);
    expect(state.player.x).toBe(area.spawn[0]);
  });
});

describe('facingOf', () => {
  test('follows the dominant axis', () => {
    expect(facingOf(1, 0.2, 'north')).toBe('east');
    expect(facingOf(-0.1, -1, 'east')).toBe('north');
  });

  test('keeps a matching facing on an exact diagonal', () => {
    expect(facingOf(0.7, 0.7, 'south')).toBe('south');
    expect(facingOf(0.7, 0.7, 'north')).toBe('east');
  });

  test('no intent keeps the facing', () => {
    expect(facingOf(0, 0, 'west')).toBe('west');
  });
});
