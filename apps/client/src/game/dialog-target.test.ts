import { describe, expect, test } from 'bun:test';
import type { NpcActorState } from '@bale/sim';
import { dialogScriptAt, npcInFront } from './dialog-target.ts';

const npc: NpcActorState = {
  id: 'mbah_hita',
  area: 'bale',
  x: 2.5,
  z: 1.5,
  facing: 'south',
  anim: 'idle',
  active: true,
  moving: false,
  scheduleDay: 0,
  scheduleIndex: 0,
  entryIndex: 0,
};

describe('dialog targeting', () => {
  test('finds the active NPC on the tile in front', () => {
    expect(
      npcInFront(
        {
          area: 'bale',
          x: 1.5,
          z: 1.5,
          facing: 'east',
          moveX: 0,
          moveZ: 0,
        },
        [npc],
      )?.id,
    ).toBe('mbah_hita');
  });

  test('ignores inactive and off-area NPCs', () => {
    const player = { area: 'bale', x: 1.5, z: 1.5, facing: 'east' as const, moveX: 0, moveZ: 0 };
    expect(npcInFront(player, [{ ...npc, active: false }])).toBeUndefined();
    expect(npcInFront(player, [{ ...npc, area: 'pasar' }])).toBeUndefined();
  });
});

test('dialog scripts follow morning, day, and evening bands', () => {
  expect(dialogScriptAt(10 * 60 + 59)).toBe('morning');
  expect(dialogScriptAt(11 * 60)).toBe('day');
  expect(dialogScriptAt(16 * 60)).toBe('evening');
});
