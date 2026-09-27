import { describe, expect, test } from 'bun:test';
import type { Command } from '@bale/sim';
import { createInputFrame, type InputFrame } from '../platform/input/input-frame.ts';
import { type Facing, screenFacing } from '../render/camera/camera-rig.ts';
import { createCommandMapper, screenToWorld } from './commands.ts';

const QUARTER = Math.PI / 2;

function mapped(frames: Partial<InputFrame>[], yaw = 0): Command[] {
  const mapper = createCommandMapper();
  const out: Command[] = [];
  for (const partial of frames) {
    mapper.map({ ...createInputFrame(), ...partial }, yaw, (command) => out.push(command));
  }
  return out;
}

describe('screenToWorld', () => {
  const world = { x: 0, z: 0 };

  test('at yaw 0, up the screen is −z and right is +x', () => {
    screenToWorld(0, 1, 0, world);
    expect(world.x).toBeCloseTo(0, 10);
    expect(world.z).toBeCloseTo(-1, 10);
    screenToWorld(1, 0, 0, world);
    expect(world.x).toBeCloseTo(1, 10);
    expect(world.z).toBeCloseTo(0, 10);
  });

  test('is the inverse of screenFacing at every camera angle', () => {
    const facing: Facing = { facing: 'down', flipX: false };
    for (let step = 0; step < 4; step++) {
      const yaw = step * QUARTER;
      // Pushing up walks away from the camera, so the sprite shows its back.
      screenToWorld(0, 1, yaw, world);
      expect(screenFacing(world.x, world.z, yaw, facing)).toEqual({ facing: 'up', flipX: false });
      // Pushing left walks left on screen: a side sprite, flipped.
      screenToWorld(-1, 0, yaw, world);
      expect(screenFacing(world.x, world.z, yaw, facing)).toEqual({ facing: 'side', flipX: true });
    }
  });
});

describe('createCommandMapper', () => {
  test('a still player sends nothing', () => {
    expect(mapped([{}, {}, {}])).toEqual([]);
  });

  test('held movement is sent when it starts, when it changes, and when it stops', () => {
    const commands = mapped([{ moveX: 1 }, { moveX: 1 }, { moveX: 1, moveY: 0 }, {}, {}]);
    expect(commands).toEqual([
      { type: 'move', x: 1, z: 0 },
      { type: 'move', x: 0, z: 0 },
    ]);
  });

  test('drift below the threshold is never sent, so it never needs a stop', () => {
    expect(mapped([{ moveX: 5e-4 }, {}])).toEqual([]);
  });

  test('a slow push that was sent still ends with an explicit stop', () => {
    const commands = mapped([{ moveX: 0.01 }, { moveX: 0.0105 }, {}]);
    expect(commands).toEqual([
      { type: 'move', x: 0.01, z: 0 },
      { type: 'move', x: 0, z: 0 },
    ]);
  });

  test('movement follows the camera: up the screen at a quarter turn is −x', () => {
    const [command] = mapped([{ moveY: 1 }], QUARTER);
    if (command?.type !== 'move') throw new Error('expected a move');
    expect(command.x).toBeCloseTo(-1, 10);
    expect(command.z).toBeCloseTo(0, 10);
  });

  test('edges map to commands in a fixed order: move, slot, cycle, interact', () => {
    expect(mapped([{ moveY: 1, slot: 4, cycle: -2, interact: true }]).map((c) => c.type)).toEqual([
      'move',
      'selectSlot',
      'cycleSlot',
      'cycleSlot',
      'interact',
    ]);
    expect(mapped([{ cycle: -2 }])).toEqual([
      { type: 'cycleSlot', delta: -1 },
      { type: 'cycleSlot', delta: -1 },
    ]);
  });
});
