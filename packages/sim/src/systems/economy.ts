import type { AreaDef } from '@bale/shared';
import type { ItemDef } from '@bale/shared/content';
import type { SimContext, System } from '../types.ts';
import type { InventoryState } from './inventory.ts';
import type { MovementState } from './movement.ts';
import type { PlayerProgressState } from './player.ts';

export interface EconomyState {
  shipping: { items: Record<string, number> };
}

export function createEconomyState(): EconomyState {
  return { shipping: { items: {} } };
}

type EconomySystemState = EconomyState & InventoryState & MovementState & PlayerProgressState;

/**
 * GDD §7: interacting with the setoran while holding produce deposits that whole stack;
 * `dayStarted` pays every deposited item at its authored base price.
 */
export function createEconomySystem(
  area: Pick<AreaDef, 'id' | 'setoran'>,
  items: readonly ItemDef[],
): System<EconomySystemState> {
  const produceById = new Map(
    items
      .filter(
        (item): item is Extract<ItemDef, { kind: 'produce' }> =>
          item.kind === 'produce' && item.sellPrice !== null,
      )
      .map((item) => [item.id, item]),
  );

  return (state, ctx) => {
    for (const event of ctx.events) {
      if (event.type !== 'dayStarted') continue;
      payShipment(state, produceById, ctx);
      break;
    }

    if (!ctx.commands.some((command) => command.type === 'interact')) return;
    if (!facesSetoran(state.player, area)) return;
    const slotIndex = state.player.selectedSlot;
    const slot = state.player.inventory[slotIndex];
    if (slot?.kind !== 'item' || !produceById.has(slot.id) || slot.quantity <= 0) return;
    const quantity = slot.quantity;
    state.shipping.items[slot.id] = (state.shipping.items[slot.id] ?? 0) + quantity;
    state.player.inventory[slotIndex] = null;
    ctx.emit({ type: 'inventoryChanged', slot: slotIndex });
    ctx.emit({ type: 'shipmentChanged', itemId: slot.id, quantity });
  };
}

function payShipment(
  state: EconomySystemState,
  produceById: ReadonlyMap<string, Extract<ItemDef, { kind: 'produce' }>>,
  ctx: SimContext,
): void {
  let count = 0;
  let money = 0;
  for (const [itemId, quantity] of Object.entries(state.shipping.items)) {
    const item = produceById.get(itemId);
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
  area: Pick<AreaDef, 'id' | 'setoran'>,
): boolean {
  if (player.area !== area.id) return false;
  const [x, z] = area.setoran;
  const targetX =
    Math.floor(player.x) + (player.facing === 'east' ? 1 : player.facing === 'west' ? -1 : 0);
  const targetZ =
    Math.floor(player.z) + (player.facing === 'south' ? 1 : player.facing === 'north' ? -1 : 0);
  return targetX === x && targetZ === z;
}
