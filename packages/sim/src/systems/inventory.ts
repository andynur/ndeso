import type { PlayerData } from '@bale/shared';
import type { ItemDef } from '@bale/shared/content';
import { HOTBAR_SLOTS } from '../commands.ts';
import type { SimContext, System } from '../types.ts';

export type InventorySlot =
  | { readonly kind: 'tool'; readonly id: string }
  | { kind: 'item'; readonly id: string; quantity: number }
  | null;

export interface InventoryPlayerState {
  inventory: InventorySlot[];
  selectedSlot: number;
}

export interface InventoryState {
  player: InventoryPlayerState;
}

export function createInventoryPlayerState(data: PlayerData): InventoryPlayerState {
  const inventory: InventorySlot[] = data.inventory.map((entry) => ({ ...entry }));
  while (inventory.length < HOTBAR_SLOTS) inventory.push(null);
  return { inventory, selectedSlot: 0 };
}

/** Applies direct slot picks and wheel/controller cycling before an interaction is resolved. */
export const inventoryCommandSystem: System<InventoryState> = (state, ctx) => {
  for (const command of ctx.commands) {
    let next = state.player.selectedSlot;
    if (command.type === 'selectSlot') next = command.slot;
    else if (command.type === 'cycleSlot') {
      next = nextOccupiedSlot(state.player.inventory, next, command.delta);
    } else continue;
    if (next === state.player.selectedSlot) continue;
    state.player.selectedSlot = next;
    ctx.emit({ type: 'slotSelected', slot: next });
  }
};

function nextOccupiedSlot(slots: readonly InventorySlot[], from: number, delta: 1 | -1): number {
  for (let step = 1; step <= HOTBAR_SLOTS; step++) {
    const slot = (from + delta * step + HOTBAR_SLOTS) % HOTBAR_SLOTS;
    if (slots[slot] !== null) return slot;
  }
  return from;
}

/** Removes one selected seed after (and only after) the farm accepted the planting action. */
export function consumeSelectedItem(
  state: InventoryState,
  itemId: string,
  ctx: SimContext,
): boolean {
  const index = state.player.selectedSlot;
  const slot = state.player.inventory[index];
  if (slot?.kind !== 'item' || slot.id !== itemId || slot.quantity < 1) return false;
  slot.quantity--;
  if (slot.quantity === 0) state.player.inventory[index] = null;
  ctx.emit({ type: 'inventoryChanged', slot: index });
  return true;
}

export function inventorySpaceFor(
  slots: readonly InventorySlot[],
  itemId: string,
  stackSize: number,
): number {
  let space = 0;
  for (const slot of slots) {
    if (slot === null) space += stackSize;
    else if (slot.kind === 'item' && slot.id === itemId) space += stackSize - slot.quantity;
  }
  return space;
}

/** Collects farm yields into stacks after farm commands have emitted `cropHarvested`. */
export function createInventoryEventSystem(items: readonly ItemDef[]): System<InventoryState> {
  const itemByCrop = new Map(
    items
      .filter((item): item is Extract<ItemDef, { kind: 'produce' }> => item.kind === 'produce')
      .map((item) => [item.cropId, item]),
  );
  return (state, ctx) => {
    for (const event of ctx.events) {
      if (event.type !== 'cropHarvested') continue;
      const fields = event as { readonly cropId?: unknown; readonly yield?: unknown };
      const { cropId, yield: quantity } = fields;
      if (typeof cropId !== 'string' || typeof quantity !== 'number' || quantity <= 0) continue;
      const item = itemByCrop.get(cropId);
      if (!item) continue;
      const remainder = addItem(state.player.inventory, item, quantity, ctx);
      if (remainder > 0) ctx.emit({ type: 'inventoryFull', itemId: item.id, quantity: remainder });
    }
  };
}

export function addItem(
  slots: InventorySlot[],
  item: ItemDef,
  quantity: number,
  ctx: SimContext,
): number {
  let remaining = quantity;
  for (let index = 0; index < slots.length && remaining > 0; index++) {
    const slot = slots[index];
    if (slot?.kind !== 'item' || slot.id !== item.id || slot.quantity >= item.stackSize) continue;
    const added = Math.min(remaining, item.stackSize - slot.quantity);
    slot.quantity += added;
    remaining -= added;
    ctx.emit({ type: 'inventoryChanged', slot: index });
  }
  for (let index = 0; index < slots.length && remaining > 0; index++) {
    if (slots[index] !== null) continue;
    const added = Math.min(remaining, item.stackSize);
    slots[index] = { kind: 'item', id: item.id, quantity: added };
    remaining -= added;
    ctx.emit({ type: 'inventoryChanged', slot: index });
  }
  return remaining;
}
