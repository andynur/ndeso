import { expect, test } from 'bun:test';
import type { ItemDef } from '@bale/shared/content';
import { createContext } from '../types.ts';
import { createEconomyState, createEconomySystem } from './economy.ts';

const area = { id: 'bale', setoran: [2, -1] as const };
const items: ItemDef[] = [
  {
    id: 'cabai',
    nameKey: 'items:item.cabai.name',
    descKey: 'items:item.cabai.desc',
    origin: 'Central Java, Indonesia',
    kind: 'produce',
    cropId: 'cabai',
    buyPrice: null,
    sellPrice: 700,
    stackSize: 99,
  },
  {
    id: 'cabai_seed',
    nameKey: 'items:item.cabai_seed.name',
    descKey: 'items:item.cabai_seed.desc',
    origin: 'Central Java, Indonesia',
    kind: 'seed',
    cropId: 'cabai',
    buyPrice: 800,
    sellPrice: null,
    stackSize: 99,
  },
];

const fresh = () => ({
  ...createEconomyState(),
  player: {
    area: 'bale',
    x: 2.5,
    z: 0.5,
    facing: 'north' as const,
    moveX: 0,
    moveZ: 0,
    inventory: [
      { kind: 'item' as const, id: 'cabai', quantity: 3 },
      { kind: 'item' as const, id: 'cabai_seed', quantity: 2 },
    ],
    selectedSlot: 0,
    stamina: 100,
    maxStamina: 100,
    money: 0,
    dayEndSummary: null,
  },
});

test('deposits the selected produce stack only while facing the setoran', () => {
  const system = createEconomySystem(area, items);
  const state = fresh();
  const ctx = createContext(1, [{ type: 'interact' }]);
  system(state, ctx);
  expect(state.shipping.items).toEqual({ cabai: 3 });
  expect(state.player.inventory[0]).toBeNull();
  expect(ctx.events).toContainEqual({ type: 'shipmentChanged', itemId: 'cabai', quantity: 3 });

  state.player.selectedSlot = 1;
  system(state, createContext(1, [{ type: 'interact' }]));
  expect(state.player.inventory[1]).toMatchObject({ id: 'cabai_seed', quantity: 2 });
});

test('pays base prices once on the next dayStarted event', () => {
  const system = createEconomySystem(area, items);
  const state = fresh();
  state.shipping.items = { cabai: 3 };
  const ctx = createContext();
  ctx.emit({ type: 'dayStarted', day: 1 });
  system(state, ctx);
  expect(state.player.money).toBe(2_100);
  expect(state.shipping.items).toEqual({});
  expect(ctx.events).toContainEqual({ type: 'shipmentPaid', count: 3, money: 2_100 });
  expect(ctx.events).toContainEqual({ type: 'moneyChanged', money: 2_100, delta: 2_100 });

  system(state, ctx);
  expect(state.player.money).toBe(2_100);
});
