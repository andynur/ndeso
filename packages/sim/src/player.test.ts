import { describe, expect, test } from 'bun:test';
import { TICKS_PER_SECOND } from '@bale/shared';
import { blockRect, createCollisionGrid } from './collision.ts';
import {
  createPlayerState,
  facingFor,
  isWalking,
  movePlayer,
  PLAYER_RADIUS,
  type PlayerState,
  WALK_SPEED,
} from './player.ts';

const STEP = WALK_SPEED / TICKS_PER_SECOND;

function walk(state: PlayerState, x: number, z: number, ticks: number, grid = open()): void {
  state.player.intent = { x, z };
  for (let i = 0; i < ticks; i++) movePlayer(state, grid);
}

function open() {
  return createCollisionGrid(-10, -10, 20, 20);
}

describe('facingFor', () => {
  test('the dominant axis wins', () => {
    expect(facingFor(0.9, -0.2, 'south')).toBe('east');
    expect(facingFor(-0.2, -0.9, 'south')).toBe('north');
    expect(facingFor(-1, 0, 'north')).toBe('west');
    expect(facingFor(0, 1, 'north')).toBe('south');
  });

  test('no intent keeps the facing', () => {
    expect(facingFor(0, 0, 'west')).toBe('west');
  });

  test('an exact diagonal keeps a facing it contains, else faces along z', () => {
    expect(facingFor(0.7, 0.7, 'east')).toBe('east');
    expect(facingFor(0.7, 0.7, 'south')).toBe('south');
    expect(facingFor(0.7, 0.7, 'north')).toBe('south');
    expect(facingFor(-0.7, -0.7, 'east')).toBe('north');
  });
});

describe('movePlayer', () => {
  test('stays below one tile per tick', () => {
    expect(STEP).toBeLessThan(1);
  });

  test('walks WALK_SPEED tiles per second along the intent and faces it', () => {
    const state = createPlayerState({ x: 0.5, z: 0.5 });
    walk(state, 1, 0, TICKS_PER_SECOND);
    expect(state.player.pos.x).toBeCloseTo(0.5 + WALK_SPEED);
    expect(state.player.pos.z).toBe(0.5);
    expect(state.player.facing).toBe('east');
  });

  test('a partial stick walks slower', () => {
    const state = createPlayerState({ x: 0.5, z: 0.5 });
    walk(state, 0, -0.5, TICKS_PER_SECOND);
    expect(state.player.pos.z).toBeCloseTo(0.5 - WALK_SPEED / 2);
    expect(state.player.facing).toBe('north');
  });

  test('stops flush against a solid tile', () => {
    const grid = open();
    blockRect(grid, 3, -10, 4, 10);
    const state = createPlayerState({ x: 0.5, z: 0.5 });
    walk(state, 1, 0, 30, grid);
    expect(state.player.pos.x).toBeCloseTo(3 - PLAYER_RADIUS);
    expect(isWalking(state.player)).toBe(true);
  });

  test('stops flush when walking west or north too', () => {
    const grid = open();
    blockRect(grid, -4, -4, -3, 4);
    blockRect(grid, -4, -4, 4, -3);
    const state = createPlayerState({ x: 0.5, z: 0.5 });
    walk(state, -1, 0, 30, grid);
    expect(state.player.pos.x).toBeCloseTo(-3 + PLAYER_RADIUS);
    walk(state, 0, -1, 30, grid);
    expect(state.player.pos.z).toBeCloseTo(-3 + PLAYER_RADIUS);
  });

  test('slides along a wall when walking into it diagonally', () => {
    const grid = open();
    blockRect(grid, -10, 2, 10, 3);
    const state = createPlayerState({ x: 0.5, z: 0.5 });
    const d = Math.SQRT1_2;
    walk(state, d, d, TICKS_PER_SECOND * 2, grid);
    expect(state.player.pos.z).toBeCloseTo(2 - PLAYER_RADIUS);
    expect(state.player.pos.x).toBeCloseTo(0.5 + WALK_SPEED * 2 * d);
  });

  test('the footprint catches a corner the centre would miss', () => {
    const grid = open();
    blockRect(grid, 3, 1, 4, 2);
    // Centre at z 0.8 is in row 0, but the footprint reaches into row 1.
    const state = createPlayerState({ x: 0.5, z: 0.8 });
    walk(state, 1, 0, 30, grid);
    expect(state.player.pos.x).toBeCloseTo(3 - PLAYER_RADIUS);
  });

  test('passes a solid tile its footprint only touches', () => {
    const grid = open();
    blockRect(grid, 3, 1, 4, 2);
    const state = createPlayerState({ x: 0.5, z: 1 - PLAYER_RADIUS });
    walk(state, 1, 0, 30, grid);
    expect(state.player.pos.x).toBeGreaterThan(4);
  });

  test('the grid edge is a wall', () => {
    const state = createPlayerState({ x: 0.5, z: 0.5 });
    walk(state, 0, 1, 100);
    expect(state.player.pos.z).toBeCloseTo(10 - PLAYER_RADIUS);
  });

  test('no intent means no movement and no turn', () => {
    const state = createPlayerState({ x: 0.5, z: 0.5 }, 'west');
    walk(state, 0, 0, 10);
    expect(state.player).toEqual({
      pos: { x: 0.5, z: 0.5 },
      facing: 'west',
      intent: { x: 0, z: 0 },
    });
    expect(isWalking(state.player)).toBe(false);
  });
});
