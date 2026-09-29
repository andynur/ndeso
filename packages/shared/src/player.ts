/**
 * Player setup (`content/data/player.json5`): movement tuning plus the starting hotbar.
 * GDD gives no walk speed, so those feel numbers are tuned on a phone rather than derived.
 */
export interface PlayerData {
  /** Walking speed at full stick, tiles per second. */
  readonly speed: number;
  /** Half the edge of the player's collision square, tiles. Under 0.5 fits a 1-tile gap. */
  readonly radius: number;
  /** Content-driven nine-slot starting loadout. Quantities apply only to stackable items. */
  readonly inventory: readonly PlayerInventoryEntry[];
}

export type PlayerInventoryEntry =
  | { readonly kind: 'tool'; readonly id: string }
  | { readonly kind: 'item'; readonly id: string; readonly quantity: number };

export type PlayerResult =
  | { readonly ok: true; readonly data: PlayerData }
  | { readonly ok: false; readonly errors: readonly string[] };

const FILE = 'player.json5';
/** One tick's step must stay under one tile, or the collision could skip a wall. */
const MAX_SPEED = 9;

export function validatePlayer(raw: unknown): PlayerResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: [`${FILE}: is not an object`] };
  }
  const { speed, radius, inventory } = raw as {
    speed?: unknown;
    radius?: unknown;
    inventory?: unknown;
  };
  const errors: string[] = [];
  if (typeof speed !== 'number' || !(speed > 0 && speed <= MAX_SPEED)) {
    errors.push(`${FILE}: speed must be a number in (0, ${MAX_SPEED}] tiles/s`);
  }
  if (typeof radius !== 'number' || !(radius > 0 && radius < 0.5)) {
    errors.push(`${FILE}: radius must be a number in (0, 0.5) tiles`);
  }
  const parsedInventory: PlayerInventoryEntry[] = [];
  if (!Array.isArray(inventory) || inventory.length > 9) {
    errors.push(`${FILE}: inventory must be a list of at most 9 entries`);
  } else {
    const ids = new Set<string>();
    for (const [index, entry] of inventory.entries()) {
      if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
        errors.push(`${FILE}: inventory.${index} must be an object`);
        continue;
      }
      const value = entry as { kind?: unknown; id?: unknown; quantity?: unknown };
      if (typeof value.id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(value.id)) {
        errors.push(`${FILE}: inventory.${index}.id must be a snake_case id`);
        continue;
      }
      if (ids.has(value.id)) errors.push(`${FILE}: inventory has duplicate id '${value.id}'`);
      ids.add(value.id);
      if (value.kind === 'tool' && value.quantity === undefined) {
        parsedInventory.push({ kind: 'tool', id: value.id });
      } else if (
        value.kind === 'item' &&
        Number.isInteger(value.quantity) &&
        (value.quantity as number) > 0
      ) {
        parsedInventory.push({ kind: 'item', id: value.id, quantity: value.quantity as number });
      } else {
        errors.push(
          `${FILE}: inventory.${index} must be a tool or an item with a positive integer quantity`,
        );
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    data: { speed: speed as number, radius: radius as number, inventory: parsedInventory },
  };
}
