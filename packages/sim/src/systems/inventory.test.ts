import { expect, test } from 'bun:test';
import type { PlayerData } from '@bale/shared';
import type { ItemDef } from '@bale/shared/content';
import { createContext } from '../types.ts';
import {
  consumeSelectedItem,
  createInventoryEventSystem,
  createInventoryPlayerState,
  type InventoryState,
  inventoryCommandSystem,
  inventorySpaceFor,
} from './inventory.ts';

const player: PlayerData = {
  speed: 4,
  radius: 0.3,
  inventory: [
    { kind: 'tool', id: 'hoe' },
    { kind: 'item', id: 'cabai_seed', quantity: 2 },
  ],
};

const cabai: ItemDef = {
  id: 'cabai',
  nameKey: 'items:item.cabai.name',
  descKey: 'items:item.cabai.desc',
  origin: 'Central Java, Indonesia',
  kind: 'produce',
  cropId: 'cabai',
  buyPrice: null,
  sellPrice: 700,
  stackSize: 4,
};

const fresh = (): InventoryState => ({ player: createInventoryPlayerState(player) });

test('selects directly and cycles through occupied slots with wrapping', () => {
  const state = fresh();
  inventoryCommandSystem(state, createContext(1, [{ type: 'cycleSlot', delta: -1 }]));
  expect(state.player.selectedSlot).toBe(1);
  inventoryCommandSystem(state, createContext(1, [{ type: 'selectSlot', slot: 8 }]));
  expect(state.player.selectedSlot).toBe(8);
  inventoryCommandSystem(state, createContext(1, [{ type: 'cycleSlot', delta: 1 }]));
  expect(state.player.selectedSlot).toBe(0);
});

test('consumes the selected stack and clears its final item', () => {
  const state = fresh();
  state.player.selectedSlot = 1;
  const first = createContext();
  expect(consumeSelectedItem(state, 'cabai_seed', first)).toBe(true);
  expect(state.player.inventory[1]).toMatchObject({ quantity: 1 });
  expect(consumeSelectedItem(state, 'cabai_seed', first)).toBe(true);
  expect(state.player.inventory[1]).toBeNull();
});

test('stacks harvests, fills empty slots, and reports overflow without losing the event', () => {
  const state = fresh();
  state.player.inventory[2] = { kind: 'item', id: 'cabai', quantity: 3 };
  for (let slot = 3; slot < state.player.inventory.length; slot++) {
    state.player.inventory[slot] = { kind: 'tool', id: `tool_${slot}` };
  }
  const ctx = createContext();
  ctx.emit({ type: 'cropHarvested', cropId: 'cabai', yield: 4 });
  createInventoryEventSystem([cabai])(state, ctx);
  expect(state.player.inventory[2]).toMatchObject({ quantity: 4 });
  expect(ctx.events).toContainEqual({ type: 'inventoryFull', itemId: 'cabai', quantity: 3 });
});

test('counts room in matching stacks and empty slots only', () => {
  const state = fresh();
  state.player.inventory[2] = { kind: 'item', id: 'cabai', quantity: 3 };
  expect(inventorySpaceFor(state.player.inventory, 'cabai', 4)).toBe(25);
});
