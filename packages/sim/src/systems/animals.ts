import type { AreaDef } from '@bale/shared';
import type { AnimalData, AnimalSpeciesDef, ItemDef } from '@bale/shared/content';
import type { SimContext, System } from '../types.ts';
import {
  addItem,
  consumeSelectedItem,
  type InventoryState,
  inventorySpaceFor,
} from './inventory.ts';
import type { MovementState } from './movement.ts';
import type { TimeState } from './time.ts';

export interface AnimalState {
  id: string;
  speciesId: string;
  area: string;
  affection: number;
  fed: boolean;
  petted: boolean;
  products: Record<string, number>;
}

export interface AnimalsState {
  animals: Record<string, AnimalState>;
}

export function createAnimalsState(data: AnimalData): AnimalsState {
  const animals: Record<string, AnimalState> = {};
  for (const resident of data.residents) {
    animals[resident.id] = {
      id: resident.id,
      speciesId: resident.speciesId,
      area: resident.area,
      affection: resident.initialAffection,
      fed: false,
      petted: false,
      products: {},
    };
  }
  return { animals };
}

type AnimalsSystemState = AnimalsState &
  InventoryState &
  MovementState &
  TimeState & { seed: number };

/** GDD §6 daily care, deterministic production, and adjacent coop interaction. */
export function createAnimalsSystem(
  area: Pick<AreaDef, 'id' | 'coop'>,
  data: AnimalData,
  items: readonly ItemDef[],
): System<AnimalsSystemState> {
  const speciesById = new Map(data.species.map((species) => [species.id, species]));
  const itemById = new Map(items.map((item) => [item.id, item]));
  const residents = data.residents
    .filter((resident) => resident.area === area.id)
    .map((resident) => resident.id);

  return (state, ctx) => {
    for (const event of ctx.events) {
      const fields = event as { readonly day?: unknown };
      const day = event.type === 'dayStarted' ? fields.day : undefined;
      if (typeof day !== 'number') continue;
      for (const animal of Object.values(state.animals)) {
        const species = speciesById.get(animal.speciesId);
        if (species) startAnimalDay(state.seed, day, animal, species, ctx);
      }
    }

    if (
      !ctx.commands.some((command) => command.type === 'interact') ||
      !facesCoop(state.player, area)
    ) {
      return;
    }
    const animal = residents.map((id) => state.animals[id]).find((entry) => entry !== undefined);
    if (!animal) return;
    const species = speciesById.get(animal.speciesId);
    if (!species) return;

    if (Object.values(animal.products).some((quantity) => quantity > 0)) {
      collectProducts(state, animal, itemById, ctx);
      return;
    }

    const selected = state.player.inventory[state.player.selectedSlot];
    if (selected?.kind === 'item' && selected.id === species.feedItemId && !animal.fed) {
      if (consumeSelectedItem(state, species.feedItemId, ctx)) {
        animal.fed = true;
        ctx.emit({ type: 'animalFed', animalId: animal.id });
      }
      return;
    }

    if (!animal.petted) {
      animal.petted = true;
      animal.affection = Math.min(species.maxAffection, animal.affection + 1);
      ctx.emit({ type: 'animalPetted', animalId: animal.id, affection: animal.affection });
    }
  };
}

function startAnimalDay(
  seed: number,
  day: number,
  animal: AnimalState,
  species: AnimalSpeciesDef,
  ctx: SimContext,
): void {
  if (animal.fed && animal.affection > 0) {
    const good =
      unitHash(seed, day, animal.id) < animal.affection * species.goodProductChancePerAffection;
    const itemId = good ? species.goodProductItemId : species.productItemId;
    animal.products[itemId] = (animal.products[itemId] ?? 0) + 1;
    ctx.emit({ type: 'animalProductProduced', animalId: animal.id, itemId, quantity: 1 });
  } else if (!animal.fed) {
    animal.affection = Math.max(0, animal.affection - 1);
    ctx.emit({ type: 'animalNeglected', animalId: animal.id, affection: animal.affection });
  }
  animal.fed = false;
  animal.petted = false;
}

function collectProducts(
  state: AnimalsSystemState,
  animal: AnimalState,
  itemById: ReadonlyMap<string, ItemDef>,
  ctx: SimContext,
): void {
  for (const [itemId, quantity] of Object.entries(animal.products)) {
    if (quantity <= 0) continue;
    const item = itemById.get(itemId);
    if (!item) continue;
    const capacity = inventorySpaceFor(state.player.inventory, itemId, item.stackSize);
    const collecting = Math.min(quantity, capacity);
    if (collecting > 0) {
      const remainder = addItem(state.player.inventory, item, collecting, ctx);
      const collected = collecting - remainder;
      animal.products[itemId] = quantity - collected;
      if (animal.products[itemId] === 0) delete animal.products[itemId];
      if (collected > 0) {
        ctx.emit({
          type: 'animalProductCollected',
          animalId: animal.id,
          itemId,
          quantity: collected,
        });
      }
    }
    const left = animal.products[itemId] ?? 0;
    if (left > 0) ctx.emit({ type: 'inventoryFull', itemId, quantity: left });
  }
}

function facesCoop(player: MovementState['player'], area: Pick<AreaDef, 'id' | 'coop'>): boolean {
  if (player.area !== area.id) return false;
  const [x, z] = area.coop;
  const targetX =
    Math.floor(player.x) + (player.facing === 'east' ? 1 : player.facing === 'west' ? -1 : 0);
  const targetZ =
    Math.floor(player.z) + (player.facing === 'south' ? 1 : player.facing === 'north' ? -1 : 0);
  return targetX === x && targetZ === z;
}

function unitHash(seed: number, day: number, id: string): number {
  let value = (seed ^ Math.imul(day + 1, 0x9e3779b9)) >>> 0;
  for (let index = 0; index < id.length; index++) {
    value = Math.imul(value ^ id.charCodeAt(index), 0x01000193) >>> 0;
  }
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return ((value ^ (value >>> 15)) >>> 0) / 0x1_0000_0000;
}
