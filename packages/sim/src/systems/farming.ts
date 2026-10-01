import type { CalendarData, MusimId } from '@bale/shared';
import type { CropDef, ItemDef, ToolDef } from '@bale/shared/content';
import { projectDay } from '../calendar.ts';
import type { TileTarget } from '../commands.ts';
import type { SimContext, System } from '../types.ts';
import { consumeSelectedItem, type InventoryState, inventorySpaceFor } from './inventory.ts';
import type { MovementState } from './movement.ts';
import type { WeatherState } from './weather.ts';

/** A stable key for the serializable farm record (ARCHITECTURE §3.3). */
export type TileKey = `${string}:${number},${number}`;

export interface FarmLocation {
  readonly area: string;
  readonly x: number;
  readonly z: number;
}

export type FarmPlot = FarmLocation &
  (
    | { readonly plot: 'tegalan' | 'kebun' }
    | { readonly plot: 'sawah'; readonly waterLevel?: 0 | 1 | 2 | 3 }
  );

type Hydration =
  | { plot: 'tegalan' | 'kebun'; watered: boolean }
  | { plot: 'sawah'; waterLevel: 0 | 1 | 2 | 3 };

type EmptyPhase = { phase: 'untilled' | 'tilled' };
interface CropFields {
  cropId: string;
  /** Productive, watered days completed since planting. */
  growthDays: number;
  /** Consecutive days without enough water; meaningful for tegalan and kebun. */
  dryDays: number;
}
type CropPhase = CropFields & ({ phase: 'seeded' } | { phase: 'mature' } | { phase: 'withered' });

/** One tile is always in exactly one phase; hydration is part of the same plain-data value. */
export type FarmTile = FarmLocation & Hydration & (EmptyPhase | CropPhase);

export interface FarmingState {
  farm: { tiles: Record<TileKey, FarmTile> };
}

export function tileKey(target: TileTarget): TileKey {
  return `${target.area}:${target.x},${target.z}`;
}

export function createFarmingState(plots: readonly FarmPlot[] = []): FarmingState {
  const tiles = {} as Record<TileKey, FarmTile>;
  for (const plot of plots) {
    const key = tileKey(plot);
    if (tiles[key] !== undefined) throw new Error(`duplicate farm tile '${key}'`);
    tiles[key] =
      plot.plot === 'sawah'
        ? { ...plot, waterLevel: plot.waterLevel ?? 0, phase: 'untilled' }
        : { ...plot, watered: false, phase: 'untilled' };
  }
  return { farm: { tiles } };
}

/** Step 3: apply farm commands. Inventory and stamina charge these actions in later tasks. */
export function createFarmCommandSystem(crops: readonly CropDef[]): System<FarmingState> {
  const cropById = indexCrops(crops);
  return (state, ctx) => {
    for (const command of ctx.commands) {
      if (command.type === 'useTool') {
        const key = tileKey(command.target);
        const tile = state.farm.tiles[key];
        if (tile === undefined) continue;
        if (command.tool === 'hoe') hoe(state, key, tile, ctx);
        else water(state, key, tile, ctx);
      } else if (command.type === 'plantSeed') {
        const key = tileKey(command.target);
        const tile = state.farm.tiles[key];
        const crop = cropById.get(command.cropId);
        if (tile !== undefined && crop !== undefined) plant(state, key, tile, crop, ctx);
      } else if (command.type === 'harvest') {
        const key = tileKey(command.target);
        const tile = state.farm.tiles[key];
        if (tile?.phase === 'mature') harvest(state, key, tile, cropById.get(tile.cropId), ctx);
      }
    }
  };
}

/** Resolves the context action from the selected hotbar slot onto the adjacent front tile. */
export function createFarmInteractionSystem(
  crops: readonly CropDef[],
  items: readonly ItemDef[],
  tools: readonly ToolDef[],
): System<FarmingState & InventoryState & MovementState> {
  const cropById = indexCrops(crops);
  const itemById = new Map(items.map((item) => [item.id, item]));
  const productByCrop = new Map(
    items
      .filter((item): item is Extract<ItemDef, { kind: 'produce' }> => item.kind === 'produce')
      .map((item) => [item.cropId, item]),
  );
  const toolById = new Map(tools.map((tool) => [tool.id, tool]));
  return (state, ctx) => {
    for (const command of ctx.commands) {
      if (command.type !== 'interact') continue;
      const target = frontTarget(state.player);
      const key = tileKey(target);
      const tile = state.farm.tiles[key];
      if (!tile) continue;

      // A ripe crop is always the context action; the player need not hunt for an empty hand.
      if (tile.phase === 'mature') {
        const crop = cropById.get(tile.cropId);
        const product = productByCrop.get(tile.cropId);
        if (!crop || !product) continue;
        if (
          inventorySpaceFor(state.player.inventory, product.id, product.stackSize) <
          crop.harvestYield
        ) {
          ctx.emit({ type: 'inventoryFull', itemId: product.id, quantity: crop.harvestYield });
          continue;
        }
        harvest(state, key, tile, crop, ctx);
        continue;
      }

      const selected = state.player.inventory[state.player.selectedSlot];
      if (selected?.kind === 'tool') {
        const action = toolById.get(selected.id)?.action;
        if (action === 'hoe') hoe(state, key, tile, ctx);
        else if (action === 'water') water(state, key, tile, ctx);
        continue;
      }
      if (selected?.kind !== 'item') continue;
      const item = itemById.get(selected.id);
      if (item?.kind !== 'seed') continue;
      const crop = cropById.get(item.cropId);
      if (!crop) continue;
      const before = state.farm.tiles[key];
      plant(state, key, tile, crop, ctx);
      if (state.farm.tiles[key] !== before) consumeSelectedItem(state, selected.id, ctx);
    }
  };
}

function frontTarget(player: MovementState['player']): TileTarget {
  const offset =
    player.facing === 'north'
      ? { x: 0, z: -1 }
      : player.facing === 'east'
        ? { x: 1, z: 0 }
        : player.facing === 'south'
          ? { x: 0, z: 1 }
          : { x: -1, z: 0 };
  return {
    area: player.area,
    x: Math.floor(player.x) + offset.x,
    z: Math.floor(player.z) + offset.z,
  };
}

/** Step 4: advance crops once for each `dayStarted` emitted by the time system. */
export function createFarmingSystem(
  crops: readonly CropDef[],
  cal: CalendarData,
): System<FarmingState & WeatherState> {
  const cropById = indexCrops(crops);
  return (state, ctx) => {
    for (const event of ctx.events) {
      const { day } = event as { readonly day?: unknown };
      if (event.type !== 'dayStarted' || typeof day !== 'number') continue;
      const musim = projectDay(day, cal).musim;
      const rainy = state.weather.today === 'rain' || state.weather.today === 'storm';
      for (const [key, current] of Object.entries(state.farm.tiles) as [TileKey, FarmTile][]) {
        // A dry day lowers sawah before growth. Rain supplies tegalan for this growth pass;
        // ordinary watering is consumed, then reset so the next day still needs water.
        const tile = current.plot === 'sawah' && !rainy ? resetDailyWater(current) : current;
        if (tile.phase !== 'seeded' && tile.phase !== 'mature') {
          state.farm.tiles[key] = tile.plot === 'sawah' ? tile : resetDailyWater(tile);
          continue;
        }
        const crop = cropById.get(tile.cropId);
        if (crop === undefined) {
          state.farm.tiles[key] = tile.plot === 'sawah' ? tile : resetDailyWater(tile);
          continue;
        }
        const advanced = advanceCrop(tile, crop, musim, rainy, key, ctx);
        state.farm.tiles[key] = advanced.plot === 'sawah' ? advanced : resetDailyWater(advanced);
      }
    }
  };
}

function indexCrops(crops: readonly CropDef[]): ReadonlyMap<string, CropDef> {
  const byId = new Map<string, CropDef>();
  for (const crop of crops) {
    if (byId.has(crop.id)) throw new Error(`duplicate crop '${crop.id}'`);
    byId.set(crop.id, crop);
  }
  return byId;
}

function hoe(state: FarmingState, key: TileKey, tile: FarmTile, ctx: SimContext): void {
  if (tile.phase !== 'untilled') return;
  state.farm.tiles[key] = { ...tile, phase: 'tilled' };
  ctx.emit({ type: 'tileHoed', key });
}

function water(state: FarmingState, key: TileKey, tile: FarmTile, ctx: SimContext): void {
  if (tile.phase === 'untilled') return;
  if ((tile.plot === 'sawah' && tile.waterLevel === 3) || (tile.plot !== 'sawah' && tile.watered)) {
    return;
  }
  const next: FarmTile =
    tile.plot === 'sawah'
      ? { ...tile, waterLevel: Math.min(3, tile.waterLevel + 1) as 0 | 1 | 2 | 3 }
      : { ...tile, watered: true };
  state.farm.tiles[key] = next;
  ctx.emit({
    type: 'tileWatered',
    key,
    waterLevel: next.plot === 'sawah' ? next.waterLevel : undefined,
  });
}

function plant(
  state: FarmingState,
  key: TileKey,
  tile: FarmTile,
  crop: CropDef,
  ctx: SimContext,
): void {
  if (tile.phase !== 'tilled' || tile.plot !== crop.plot) return;
  state.farm.tiles[key] = { ...tile, phase: 'seeded', cropId: crop.id, growthDays: 0, dryDays: 0 };
  ctx.emit({ type: 'cropPlanted', key, cropId: crop.id });
}

function harvest(
  state: FarmingState,
  key: TileKey,
  tile: Extract<FarmTile, { phase: 'mature' }>,
  crop: CropDef | undefined,
  ctx: SimContext,
): void {
  if (crop === undefined) return;
  if (crop.regrowDays === null) {
    state.farm.tiles[key] = clearCrop(tile, 'untilled');
  } else {
    state.farm.tiles[key] = {
      ...tile,
      phase: 'seeded',
      growthDays: Math.max(0, crop.growDays - crop.regrowDays),
      dryDays: 0,
    };
  }
  ctx.emit({ type: 'cropHarvested', key, cropId: crop.id, yield: crop.harvestYield });
}

function clearCrop(tile: FarmTile, phase: 'untilled' | 'tilled'): FarmTile {
  const location = { area: tile.area, x: tile.x, z: tile.z };
  return tile.plot === 'sawah'
    ? { ...location, plot: tile.plot, waterLevel: tile.waterLevel, phase }
    : { ...location, plot: tile.plot, watered: tile.watered, phase };
}

function resetDailyWater(tile: FarmTile): FarmTile {
  if (tile.plot === 'sawah') {
    return { ...tile, waterLevel: Math.max(0, tile.waterLevel - 1) as 0 | 1 | 2 | 3 };
  }
  return { ...tile, watered: false };
}

function advanceCrop(
  tile: Extract<FarmTile, { phase: 'seeded' | 'mature' }>,
  crop: CropDef,
  musim: MusimId,
  rainy: boolean,
  key: TileKey,
  ctx: SimContext,
): FarmTile {
  if (crop.musim !== 'semua' && crop.musim !== musim) {
    ctx.emit({ type: 'cropWithered', key, cropId: crop.id, reason: 'musim' });
    return { ...tile, phase: 'withered' };
  }

  const hasWater = tile.plot === 'sawah' ? tile.waterLevel >= 2 : tile.watered || rainy;
  if (!hasWater) {
    const dryDays = tile.dryDays + 1;
    if (tile.plot !== 'sawah' && dryDays >= crop.dryDaysToWither) {
      ctx.emit({ type: 'cropWithered', key, cropId: crop.id, reason: 'dry' });
      return { ...tile, phase: 'withered', dryDays };
    }
    return { ...tile, dryDays };
  }

  if (tile.phase === 'mature') return { ...tile, dryDays: 0 };

  const growthDays = tile.growthDays + 1;
  if (growthDays >= crop.growDays) {
    ctx.emit({ type: 'cropMatured', key, cropId: crop.id });
    return { ...tile, phase: 'mature', growthDays, dryDays: 0 };
  }
  return { ...tile, growthDays, dryDays: 0 };
}
