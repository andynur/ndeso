import type { AreaDef, CalendarData, MarketData } from '@bale/shared';
import type { ItemDef } from '@bale/shared/content';
import { pasaranOf } from '../calendar.ts';
import type { Command } from '../commands.ts';
import type { SimContext, System } from '../types.ts';
import { addItem, type InventoryState, inventorySpaceFor } from './inventory.ts';
import type { MovementState } from './movement.ts';
import type { PlayerProgressState } from './player.ts';
import type { TimeState } from './time.ts';

export interface EconomyState {
  shipping: { items: Record<string, number> };
}

export function createEconomyState(): EconomyState {
  return { shipping: { items: {} } };
}

type EconomySystemState = EconomyState &
  InventoryState &
  MovementState &
  PlayerProgressState &
  TimeState & { seed: number };

/**
 * GDD §7: setoran pays base price next morning; Bu Ratna trades seeds and produce during
 * her authored morning hours, with stable seeded produce prices for the current day.
 */
export function createEconomySystem(
  area: Required<Pick<AreaDef, 'id' | 'setoran'>>,
  items: readonly ItemDef[],
  cal: CalendarData,
  market: MarketData,
): System<EconomySystemState> {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const sellableById = new Map(
    items
      .filter((item): item is ItemDef & { sellPrice: number } => item.sellPrice !== null)
      .map((item) => [item.id, item]),
  );

  return (state, ctx) => {
    for (const event of ctx.events) {
      if (event.type !== 'dayStarted') continue;
      payShipment(state, sellableById, ctx);
      break;
    }

    for (const command of ctx.commands) {
      if (command.type === 'buyItem' || command.type === 'sellItem') {
        tradeAtMarket(state, command, itemById, cal, market, ctx);
      }
    }

    if (
      ctx.commands.some((command) => command.type === 'interact') &&
      facesSetoran(state.player, area)
    ) {
      depositSelectedProduct(state, sellableById, ctx);
    }
  };
}

export function marketIsOpen(minute: number, market: MarketData): boolean {
  const wallMinute = minute % 1440;
  return wallMinute >= market.openMinute && wallMinute < market.closeMinute;
}

/** Stable daily price per save, day, and item; reloading cannot reroll the market. */
export function marketSellPrice(
  basePrice: number,
  itemId: string,
  seed: number,
  day: number,
  cal: CalendarData,
  market: MarketData,
): number {
  const favorable = market.favorablePasaran.includes(pasaranOf(day, cal));
  const [minimum, maximum] = favorable ? market.favorableSellPercent : market.regularSellPercent;
  const percent = minimum + Math.floor(unitHash(seed, day, itemId) * (maximum - minimum + 1));
  return Math.max(1, Math.round((basePrice * percent) / 100));
}

function tradeAtMarket(
  state: EconomySystemState,
  command: Extract<Command, { type: 'buyItem' | 'sellItem' }>,
  itemById: ReadonlyMap<string, ItemDef>,
  cal: CalendarData,
  market: MarketData,
  ctx: SimContext,
): void {
  if (command.marketId !== market.id) return;
  if (!marketIsOpen(state.clock.minute, market)) {
    ctx.emit({ type: 'marketClosed', marketId: market.id });
    return;
  }
  const item = itemById.get(command.itemId);
  if (!item) return;
  if (command.type === 'buyItem') {
    if (item.kind !== 'seed' || item.buyPrice === null) return;
    const total = item.buyPrice * command.quantity;
    if (state.player.money < total) {
      ctx.emit({ type: 'moneyShort', marketId: market.id, money: total - state.player.money });
      return;
    }
    if (inventorySpaceFor(state.player.inventory, item.id, item.stackSize) < command.quantity) {
      ctx.emit({ type: 'inventoryFull', itemId: item.id, quantity: command.quantity });
      return;
    }
    addItem(state.player.inventory, item, command.quantity, ctx);
    state.player.money -= total;
    ctx.emit({
      type: 'marketBought',
      marketId: market.id,
      itemId: item.id,
      quantity: command.quantity,
      money: total,
    });
    ctx.emit({ type: 'moneyChanged', money: state.player.money, delta: -total });
    return;
  }
  if (item.kind !== 'produce' || item.sellPrice === null) return;
  const available = state.player.inventory.reduce(
    (total, slot) => total + (slot?.kind === 'item' && slot.id === item.id ? slot.quantity : 0),
    0,
  );
  if (available < command.quantity) return;
  removeItem(state.player.inventory, item.id, command.quantity, ctx);
  const unitPrice = marketSellPrice(
    item.sellPrice,
    item.id,
    state.seed,
    state.clock.day,
    cal,
    market,
  );
  const total = unitPrice * command.quantity;
  state.player.money += total;
  ctx.emit({
    type: 'marketSold',
    marketId: market.id,
    itemId: item.id,
    quantity: command.quantity,
    unitPrice,
    money: total,
  });
  ctx.emit({ type: 'moneyChanged', money: state.player.money, delta: total });
}

function removeItem(
  inventory: InventoryState['player']['inventory'],
  itemId: string,
  quantity: number,
  ctx: SimContext,
): void {
  let remaining = quantity;
  for (let index = inventory.length - 1; index >= 0 && remaining > 0; index--) {
    const slot = inventory[index];
    if (slot?.kind !== 'item' || slot.id !== itemId) continue;
    const removed = Math.min(slot.quantity, remaining);
    slot.quantity -= removed;
    remaining -= removed;
    if (slot.quantity === 0) inventory[index] = null;
    ctx.emit({ type: 'inventoryChanged', slot: index });
  }
}

function depositSelectedProduct(
  state: EconomySystemState,
  sellableById: ReadonlyMap<string, ItemDef & { sellPrice: number }>,
  ctx: SimContext,
): void {
  const slotIndex = state.player.selectedSlot;
  const slot = state.player.inventory[slotIndex];
  if (slot?.kind !== 'item' || !sellableById.has(slot.id) || slot.quantity <= 0) return;
  const quantity = slot.quantity;
  state.shipping.items[slot.id] = (state.shipping.items[slot.id] ?? 0) + quantity;
  state.player.inventory[slotIndex] = null;
  ctx.emit({ type: 'inventoryChanged', slot: slotIndex });
  ctx.emit({ type: 'shipmentChanged', itemId: slot.id, quantity });
}

function unitHash(seed: number, day: number, itemId: string): number {
  let value = (seed ^ Math.imul(day + 1, 0x9e3779b9)) >>> 0;
  for (let index = 0; index < itemId.length; index++) {
    value = Math.imul(value ^ itemId.charCodeAt(index), 0x01000193) >>> 0;
  }
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000;
}

function payShipment(
  state: EconomySystemState,
  sellableById: ReadonlyMap<string, ItemDef & { sellPrice: number }>,
  ctx: SimContext,
): void {
  let count = 0;
  let money = 0;
  for (const [itemId, quantity] of Object.entries(state.shipping.items)) {
    const item = sellableById.get(itemId);
    if (!item || item.sellPrice === null || quantity <= 0) continue;
    count += quantity;
    money += quantity * item.sellPrice;
  }
  state.shipping.items = {};
  if (count === 0) return;
  state.player.money += money;
  ctx.emit({ type: 'shipmentPaid', count, money });
  ctx.emit({ type: 'moneyChanged', money: state.player.money, delta: money });
}

function facesSetoran(
  player: MovementState['player'],
  area: Required<Pick<AreaDef, 'id' | 'setoran'>>,
): boolean {
  if (player.area !== area.id) return false;
  const [x, z] = area.setoran;
  const targetX =
    Math.floor(player.x) + (player.facing === 'east' ? 1 : player.facing === 'west' ? -1 : 0);
  const targetZ =
    Math.floor(player.z) + (player.facing === 'south' ? 1 : player.facing === 'north' ? -1 : 0);
  return targetX === x && targetZ === z;
}
