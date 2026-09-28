import { describe, expect, test } from 'bun:test';
import { TICKS_PER_SECOND } from '@bale/shared';
import { createCollisionGrid } from '../collision.ts';
import type { Command } from '../commands.ts';
import { createPlayerState, WALK_SPEED } from '../player.ts';
import { createContext } from '../types.ts';
import { createCommandsSystem } from './commands.ts';

const STEP = WALK_SPEED / TICKS_PER_SECOND;

function setup() {
  const system = createCommandsSystem(createCollisionGrid(-10, -10, 20, 20));
  const state = createPlayerState({ x: 0, z: 0 });
  const run = (commands: Command[] = [], ticks = 1) =>
    system(state, createContext(ticks, commands));
  return { state, run };
}

describe('commands system', () => {
  test('a move is held until the next one', () => {
    const { state, run } = setup();
    run([{ type: 'move', x: 1, z: 0 }]);
    run();
    run();
    expect(state.player.pos.x).toBeCloseTo(STEP * 3);
    run([{ type: 'move', x: 0, z: 0 }]);
    run();
    expect(state.player.pos.x).toBeCloseTo(STEP * 3);
    expect(state.player.intent).toEqual({ x: 0, z: 0 });
  });

  test('the last move in a step wins', () => {
    const { state, run } = setup();
    run([{ type: 'move', x: 1, z: 0 }, { type: 'interact' }, { type: 'move', x: 0, z: -1 }]);
    expect(state.player.pos).toEqual({ x: 0, z: -STEP });
    expect(state.player.facing).toBe('north');
  });

  test('a catch-up step walks every tick', () => {
    const { state, run } = setup();
    run([{ type: 'move', x: 1, z: 0 }], 4);
    expect(state.player.pos.x).toBeCloseTo(STEP * 4);
  });

  test('other commands leave the player alone', () => {
    const { state, run } = setup();
    run([{ type: 'interact' }, { type: 'selectSlot', slot: 2 }, { type: 'cycleSlot', delta: 1 }]);
    expect(state.player.pos).toEqual({ x: 0, z: 0 });
  });

  test('replays deterministically from the same commands', () => {
    const script: Command[][] = [
      [{ type: 'move', x: 0.6, z: 0.8 }],
      [],
      [{ type: 'move', x: -1, z: 0 }],
      [],
      [],
      [{ type: 'move', x: 0, z: 0 }],
    ];
    const a = setup();
    const b = setup();
    for (const step of script) {
      a.run(step);
      b.run(step);
    }
    expect(a.state).toEqual(b.state);
  });
});
