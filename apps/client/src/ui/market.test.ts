import { expect, test } from 'bun:test';
import { CALENDAR_DATA } from '@bale/content/calendar';
import { ITEM_DATA } from '@bale/content/inventory';
import { MARKET_DATA } from '@bale/content/market';
import type { InventorySlot } from '@bale/sim';
import { marketViewOf } from './market.tsx';

test('projects market rows from sim money, inventory, clock, and seeded prices', () => {
  const inventory: InventorySlot[] = [
    { kind: 'item', id: 'cabai_seed', quantity: 2 },
    { kind: 'item', id: 'cabai', quantity: 3 },
  ];
  const view = marketViewOf(
    { money: 2_000, inventory },
    { day: 0, minute: 360 },
    123,
    ITEM_DATA,
    CALENDAR_DATA,
    MARKET_DATA,
  );
  expect(view.money).toBe(2_000);
  expect(view.isOpen).toBe(true);
  expect(view.seeds.find((item) => item.id === 'cabai_seed')).toMatchObject({
    price: 800,
    owned: 2,
  });
  expect(view.produce.find((item) => item.id === 'cabai')).toMatchObject({ owned: 3 });

  const closed = marketViewOf(
    { money: 2_000, inventory },
    { day: 0, minute: MARKET_DATA.closeMinute },
    123,
    ITEM_DATA,
    CALENDAR_DATA,
    MARKET_DATA,
  );
  expect(closed.isOpen).toBe(false);
  expect(closed.produce.find((item) => item.id === 'cabai')?.price).toBe(
    view.produce.find((item) => item.id === 'cabai')?.price,
  );
});
