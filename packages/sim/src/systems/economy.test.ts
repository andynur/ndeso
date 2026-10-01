import { expect, test } from 'bun:test';
import type { MarketData } from '@bale/shared';
import type { ItemDef } from '@bale/shared/content';
import { pasaranOf } from '../calendar.ts';
import { loadCalendarForTests } from '../testing/calendar-data.ts';
import { createContext } from '../types.ts';
import {
  createEconomyState,
  createEconomySystem,
  marketIsOpen,
  marketSellPrice,
} from './economy.ts';

const cal = await loadCalendarForTests();
const market: MarketData = {
  id: 'pasar_baledono',
  nameKey: 'ui:market.name',
  sellerNameKey: 'ui:market.seller',
  openMinute: 270,
  closeMinute: 690,
  favorablePasaran: ['legi', 'kliwon'],
  regularSellPercent: [85, 115],
  favorableSellPercent: [110, 140],
};

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
  {
    id: 'telur',
    nameKey: 'items:item.telur.name',
    descKey: 'items:item.telur.desc',
    origin: 'Central Java, Indonesia',
    kind: 'animal_product',
    buyPrice: null,
    sellPrice: 1200,
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
  seed: 0x42414c45,
  clock: { tick: 0, day: 0, minute: 360 },
});

test('deposits the selected produce stack only while facing the setoran', () => {
  const system = createEconomySystem(area, items, cal, market);
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
  const system = createEconomySystem(area, items, cal, market);
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

test('setoran accepts a sellable animal product', () => {
  const system = createEconomySystem(area, items, cal, market);
  const state = fresh();
  state.player.inventory[0] = { kind: 'item', id: 'telur', quantity: 2 };
  system(state, createContext(1, [{ type: 'interact' }]));
  expect(state.shipping.items).toEqual({ telur: 2 });

  const morning = createContext();
  morning.emit({ type: 'dayStarted', day: 1 });
  system(state, morning);
  expect(state.player.money).toBe(2400);
});

test('buys seeds atomically and rejects closed, unaffordable, or full purchases', () => {
  const system = createEconomySystem(area, items, cal, market);
  const state = fresh();
  state.player.money = 2_000;
  const bought = createContext(1, [
    { type: 'buyItem', marketId: market.id, itemId: 'cabai_seed', quantity: 2 },
  ]);
  system(state, bought);
  expect(state.player.money).toBe(400);
  expect(state.player.inventory[1]).toMatchObject({ id: 'cabai_seed', quantity: 4 });
  expect(bought.events).toContainEqual({
    type: 'marketBought',
    marketId: market.id,
    itemId: 'cabai_seed',
    quantity: 2,
    money: 1_600,
  });

  state.clock.minute = market.closeMinute;
  const closed = createContext(1, [
    { type: 'buyItem', marketId: market.id, itemId: 'cabai_seed', quantity: 1 },
  ]);
  system(state, closed);
  expect(state.player.money).toBe(400);
  expect(closed.events).toContainEqual({ type: 'marketClosed', marketId: market.id });

  state.clock.minute = market.openMinute;
  const short = createContext(1, [
    { type: 'buyItem', marketId: market.id, itemId: 'cabai_seed', quantity: 1 },
  ]);
  system(state, short);
  expect(state.player.money).toBe(400);
  expect(short.events).toContainEqual({ type: 'moneyShort', marketId: market.id, money: 400 });

  state.player.money = 2_000;
  state.player.inventory = [
    { kind: 'item', id: 'cabai', quantity: 99 },
    { kind: 'item', id: 'cabai_seed', quantity: 99 },
  ];
  const full = createContext(1, [
    { type: 'buyItem', marketId: market.id, itemId: 'cabai_seed', quantity: 1 },
  ]);
  system(state, full);
  expect(state.player.money).toBe(2_000);
  expect(full.events).toContainEqual({ type: 'inventoryFull', itemId: 'cabai_seed', quantity: 1 });
});

test('sells produce at a deterministic daily price and removes the requested quantity', () => {
  const system = createEconomySystem(area, items, cal, market);
  const state = fresh();
  const expected = marketSellPrice(700, 'cabai', state.seed, state.clock.day, cal, market);
  const ctx = createContext(1, [
    { type: 'sellItem', marketId: market.id, itemId: 'cabai', quantity: 2 },
  ]);
  system(state, ctx);
  expect(state.player.inventory[0]).toMatchObject({ id: 'cabai', quantity: 1 });
  expect(state.player.money).toBe(expected * 2);
  expect(ctx.events).toContainEqual({
    type: 'marketSold',
    marketId: market.id,
    itemId: 'cabai',
    quantity: 2,
    unitPrice: expected,
    money: expected * 2,
  });
  expect(marketSellPrice(700, 'cabai', state.seed, state.clock.day, cal, market)).toBe(expected);
});

test('market hours wrap game minutes and favorable days never pay below 110 percent', () => {
  expect(marketIsOpen(270, market)).toBe(true);
  expect(marketIsOpen(689, market)).toBe(true);
  expect(marketIsOpen(690, market)).toBe(false);
  for (let day = 0; day < 20; day++) {
    const price = marketSellPrice(700, 'cabai', 123, day, cal, market);
    const favorable = market.favorablePasaran.includes(
      // Verify the contract through the price band; days outside it may overlap at 110–115%.
      pasaranOf(day, cal),
    );
    if (favorable) expect(price).toBeGreaterThanOrEqual(770);
  }
});
